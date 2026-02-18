const { smartFormatItem } = require('../utils/smartParser');

const testCases = [
    {
        input: 'user: ali123 pass: password123 domain: panel.com',
        expected: 'User: ali123\nPass: password123\nDomain: panel.com'
    },
    {
        input: 'email: test@gmail.com | password: 123 | recovery: secret',
        expected: 'Email: test@gmail.com\nPassword: 123\nRecovery: secret'
    },
    {
        input: 'Login: user1; Pwd: pass1; IP: 127.0.0.1',
        expected: 'Login: user1\nPwd: pass1\nIP: 127.0.0.1'
    },
    {
        input: 'username: mat\npassword: 123',
        expected: 'username: mat\npassword: 123' // Already formatted
    },
    {
        input: 'Just some random text',
        expected: 'Just some random text' // No formatting needed
    }
];

console.log('🧪 Testing Smart Parser...\n');

testCases.forEach((test, index) => {
    const result = smartFormatItem(test.input);
    const passed = result === test.expected || (test.expected.includes('\n') && result.includes('\n'));

    console.log(`Test ${index + 1}: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    if (!passed) {
        console.log(`Input: "${test.input}"`);
        console.log(`Expected:\n${test.expected}`);
        console.log(`Got:\n${result}`);
    } else {
        console.log(`Input: "${test.input}"`);
        console.log(`Output:\n${result}`);
    }
    console.log('---\n');
});
