// The basic idea is that you enter a couple of categories you want the quiz to sort people into
//  (i.e. shape rotators vs wordcels, which type of bad british food are you, etc), and then it 
//  dynamically comes up with some questions to ask the user to determine which category they're in. 
//  It should only generate one question at a time, and should keep a running tally of the subjective 
//  probabilities the user is in each category after each question, and then choose which 
//  new question to ask based on what would be maximally helpful for distinguishing between 
//  the categories that are close, and resolving only once a clear winner is reached.
import type { NextApiRequest, NextApiResponse } from 'next'
import { Configuration, OpenAIApi } from 'openai';
import axios from 'axios';
import logger from '../../logger';
import { QuizState, Category } from '../../types';

const configuration = new Configuration({
  apiKey: process.env.GPT4_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function callGPT4(prompt: string): Promise<string | undefined> {
    logger.info({ message: "Beginning call to GPT-4", data: { prompt } });
    try {
      const response = await openai.createChatCompletion({
        model: 'gpt-4',
        messages: [
          { role: 'user', content: prompt },
        ],
      });
  
      if (response.status === 429) {
        // Wait for 1 second and try again
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return await callGPT4(prompt);
      }
  
      if (response.data.choices && response.data.choices.length > 0) {
        logger.info({ message: "GPT-4 response received", data: { response: response.data.choices[0].message } });
        return response.data.choices[0].message?.content.trim();
      } else {
        throw new Error('No response from GPT-4');
      }
    } catch (error) {
      logger.error({ message: "Error calling GPT-4", error });
      throw error;
    }
  }

  async function callGPT4JSON(prompt: string): Promise<any> {
    const response = await callGPT4(prompt);
    if (response) {
      try {
        return JSON.parse(response);
      } catch (error) {
        logger.error({ message: "Error parsing GPT-4 response as JSON", error });
        throw error;
      }
    } else {
      throw new Error('No response from GPT-4');
    }
  }

  export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const quizState: QuizState = req.body.quizState;
  
    // Update probabilities if an answer has been given
    if (quizState.currentCategory && req.body.answer) {
      // Ask GPT-4 to update the probabilities
      const prompt = `Given the following scenarios and responses, please generate the next scenario:
  
      Scenario 1:
      Previous Category: "Shape Rotator"
      User's Answer: "I prefer triangles over squares"
      Categories: Shape Rotator: 0.6, Wordcel: 0.4
      Response: { "Shape Rotator": 0.7, "Wordcel": 0.3 }
  
      Scenario 2:
      Previous Category: "Wordcel"
      User's Answer: "I enjoy reading novels"
      Categories: Shape Rotator: 0.3, Wordcel: 0.7
      Response: { "Shape Rotator": 0.2, "Wordcel": 0.8 }
  
      Next Scenario:
      Previous Category: "${quizState.currentCategory}"
      User's Answer: "${req.body.answer}"
      Categories: ${quizState.categories.map(category => `${category.name}: ${category.probability}`).join(', ')}
      Response: `;
      const probabilityUpdates = await callGPT4JSON(prompt);
  
      // Update the category probabilities based on GPT-4's answer
      quizState.categories = updateProbabilities(quizState.categories, probabilityUpdates);
    }
  
    // Generate the next question
    const questionPrompt = `Given the following scenarios and responses, please generate the next question:
  
      Scenario 1:
      Categories: Shape Rotator: 0.7, Wordcel: 0.3
      Response: "Do you enjoy puzzles that involve manipulating shapes?"
  
      Scenario 2:
      Categories: Shape Rotator: 0.2, Wordcel: 0.8
      Response: "How often do you read for pleasure?"
  
      Next Scenario:
      Categories: ${quizState.categories.map(category => `${category.name}: ${category.probability}`).join(', ')}
      Response: `;
    const nextQuestion = await callGPT4(questionPrompt);
    if (!nextQuestion) {
      res.status(500).json({ error: 'No response from GPT-4' });
      return;
    }
    quizState.currentQuestion = nextQuestion;
  
    // Determine if there's a clear winner
    const winnerCategory = quizState.categories.find(category => category.probability >= 0.8); // or whatever threshold you want
    if (winnerCategory) {
      res.status(200).json({ winner: winnerCategory.name });
    } else {
      res.status(200).json(quizState);
    }
  }  
  
 function updateProbabilities(categories: Category[], probabilityUpdates: any): Category[] {
  for (let category of categories) {
    if (probabilityUpdates[category.name] !== undefined) {
      category.probability = probabilityUpdates[category.name];
    }
  }
  return categories;
}
  
