const tseslint = require("@typescript-eslint/eslint-plugin");

const tsFiles = ["**/*.ts", "**/*.tsx"];

const tsConfigs = tseslint.configs["flat/recommended"].map((config, index) => {
  const next = {
    ...config,
    files: tsFiles
  };

  if (index === 0) {
    next.languageOptions = {
      ...config.languageOptions,
      parserOptions: {
        ...(config.languageOptions?.parserOptions ?? {}),
        ecmaVersion: 2022,
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: __dirname
      }
    };
  }

  return next;
});

module.exports = [
  {
    ignores: ["dist/**", "node_modules/**", "**/*.d.ts"]
  },
  ...tsConfigs,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs"
    }
  },
  {
    files: tsFiles,
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-declaration-merging": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ]
    }
  }
];
