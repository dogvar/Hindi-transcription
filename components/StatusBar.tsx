import React from 'react';
import type { ProcessingStep, StepStatus } from '../types';

interface StatusBarProps {
  steps: ProcessingStep[];
}

const StatusIcon: React.FC<{ status: StepStatus }> = ({ status }) => {
  switch (status) {
    case 'in-progress':
      return (
        <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      );
    case 'success':
      return (
        <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    case 'error':
      return (
        <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      );
    case 'pending':
    default:
      return <div className="h-5 w-5 flex-shrink-0 rounded-full bg-gray-600 border-2 border-gray-500"></div>;
  }
};

const StatusBar: React.FC<StatusBarProps> = ({ steps }) => {
  return (
    <div className="bg-gray-700/50 rounded-lg p-4 space-y-3 animate-fade-in">
       <h3 className="text-md font-semibold text-gray-200 mb-2">Generation Progress</h3>
      {steps.map((step) => (
        <div key={step.name} className="flex items-center space-x-3">
          <StatusIcon status={step.status} />
          <div className="flex flex-col">
            <span className={`text-sm font-medium ${
              step.status === 'success' ? 'text-green-400' : 
              step.status === 'error' ? 'text-red-400' : 'text-gray-300'
            }`}>
              {step.label}
            </span>
            {step.status === 'error' && step.error && (
                <span className="text-xs text-red-400/80">{step.error}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatusBar;
