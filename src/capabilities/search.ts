// Re-export everything from the modular search implementation
export * from './search/index';

// For backward compatibility, maintain existing exports
export { 
  SearchCapability,
  createCitationFromRecord,
  groupMessagesByTime 
} from './search/index';
