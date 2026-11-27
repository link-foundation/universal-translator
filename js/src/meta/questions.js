// An introspection question has an aspect and an ordinary subject expression.
export const questionAspects = ['type', 'documentation', 'source', 'details'];
export const questionKey = (aspect) => `question-${aspect}`;
export const answerKey = (aspect) => `answer-${aspect}`;
