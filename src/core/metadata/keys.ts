const ensureSymbolMetadata = (): void => {
  const symbolCtor = Symbol as unknown as { metadata?: symbol };
  if (!symbolCtor.metadata) {
    symbolCtor.metadata = Symbol('metadata');
  }
};

ensureSymbolMetadata();

export const METADATA_KEYS = {
  controller: Symbol.for('adorn:controller'),
  methods: Symbol.for('adorn:methods')
};
