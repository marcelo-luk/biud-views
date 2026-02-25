module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: 'tsconfig.json',
        sourceType: 'module',
    },
    plugins: ['import','@typescript-eslint/eslint-plugin'],
    extends: [
        'plugin:@typescript-eslint/recommended',
        'eslint-config-airbnb-typescript/base',
        'plugin:prettier/recommended',
    ],
    root: true,
    env: {
        node: true,
        jest: true,
    },
    ignorePatterns: ['.eslintrc.js'],
    rules: {
        "no-console": 2,
        '@typescript-eslint/interface-name-prefix': 'off',
        "@typescript-eslint/no-floating-promises": "error",
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        'prettier/prettier': [
            'error',
            {
                evDependencies: true,
                endOfLine: 'lf',
            },
        ],
        "import/extensions": [
            "error",
            "ignorePackages",
            {
                "js": "always",
                "jsx": "never",
                "ts": "never",
                "tsx": "never"
            }
        ],
    },
};
