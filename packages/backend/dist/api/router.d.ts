import express from 'express';
import { ExamAgentController } from '../agent/ExamAgentController.js';
import { QuestionBankManager } from '../agent/QuestionBankManager.js';
export declare const createRouter: (questionBankManager: QuestionBankManager, examAgentController: ExamAgentController) => express.Router;
