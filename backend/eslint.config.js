import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: "module",
            globals: {
                process: "readonly",
                console: "readonly",
                setTimeout: "readonly",
                setInterval: "readonly",
                Buffer: "readonly",
                clearInterval: "readonly",
                clearTimeout: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-console": "off"
        }
    }
];
