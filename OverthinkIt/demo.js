#!/usr/bin/env node

// Demo CLI for Overthink It — simulates the Mac app behavior
// Run: node demo.js

const questions = [
  "Should I reply to that email now or later?",
  "Should I have a second coffee?",
  "Should I order pizza or cook tonight?"
];

const mockResponses = [
  {
    question: "Should I reply to that email now or later?",
    anxietyLevel: 8,
    scenarios: [
      "If you reply now, you'll seem desperate for approval and they'll respond immediately expecting a full conversation you're not emotionally prepared for.",
      "If you wait too long, they'll assume you're ghosting them professionally, tell their network, and you'll never get a job in this industry again.",
      "The act of staring at the email for 45 minutes without replying has already been logged by Gmail analytics and sold to your future employer.",
      "Replying later means you'll forget entirely, remember at 2am, send a typo-filled panic email, and spend the next 3 days refreshing your inbox.",
      "Either way, the email sits in their 'to follow up' folder forever, silently judging you from a server in Iowa until the heat death of the universe."
    ],
    bottomLine: "So basically... the email has already won, and nothing you do will change that."
  },
  {
    question: "Should I have a second coffee?",
    anxietyLevel: 7,
    scenarios: [
      "A second coffee will make your heart beat slightly faster, which your body will interpret as existential dread, making you 40% less productive than if you'd had none.",
      "You'll feel great for 20 minutes, then crash at exactly the worst possible moment — a meeting, a call, or a life decision you didn't know was coming.",
      "Your sleep tonight will be delayed by 23 minutes, creating a debt that compounds over 14 days until you become a different, worse person.",
      "The barista remembers you ordered twice yesterday too — you are becoming 'the two coffees person' and there is no coming back from that identity.",
      "Centuries from now, historians will point to decisions like this as the moment Western civilization chose comfort over discipline."
    ],
    bottomLine: "So basically... your arteries already know the answer, you're just looking for permission."
  },
  {
    question: "Should I order pizza or cook tonight?",
    anxietyLevel: 6,
    scenarios: [
      "Cooking means you'll spend 45 minutes on something you'll eat in 8 minutes, and the kitchen will still be dirty at midnight when you're too tired to care.",
      "Ordering pizza means a stranger knows your address, your dinner schedule, and that you couldn't face a pan on a Wednesday — they will judge you.",
      "If you cook, you'll open the fridge, realize you're missing one ingredient, and spend 20 minutes deciding if the dish is even worth making without it.",
      "The pizza arrives cold because you changed your mind 3 times during checkout, and now you've wasted $18 and your last shred of decisiveness.",
      "Either choice leads to the same outcome: eating alone in front of a screen, wondering if this is the night you finally call your mom back."
    ],
    bottomLine: "So basically... you're not choosing dinner, you're choosing which version of disappointment feels most familiar."
  }
];

// Terminal colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  purple: '\x1b[35m',
  brightPurple: '\x1b[95m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
  white: '\x1b[97m',
  bgPurple: '\x1b[45m',
  bgDark: '\x1b[40m',
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function anxietyBar(level) {
  const filled = '█'.repeat(level);
  const empty = '░'.repeat(10 - level);
  const color = level >= 8 ? c.red : level >= 5 ? c.yellow : c.green;
  return `${color}${filled}${c.gray}${empty}${c.reset}`;
}

function wrap(text, width = 64, indent = '') {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > width) {
      lines.push(indent + current.trim());
      current = word;
    } else {
      current += ' ' + word;
    }
  }
  if (current.trim()) lines.push(indent + current.trim());
  return lines.join('\n');
}

async function runDemo() {
  console.clear();

  // App header
  console.log('\n' + c.bgDark + c.brightPurple + c.bold);
  console.log('  🧠  OVERTHINK IT  —  Mac Menu Bar App                ');
  console.log(c.reset + c.gray + '  AI-powered anxiety for every decision\n' + c.reset);

  await sleep(600);

  for (let i = 0; i < mockResponses.length; i++) {
    const { question, anxietyLevel, scenarios, bottomLine } = mockResponses[i];

    // Question
    console.log(c.bold + c.white + '❯ ' + c.reset + c.italic + `"${question}"` + c.reset);
    await sleep(400);

    // Simulating API call
    process.stdout.write(c.gray + '  ⏳ Spiraling');
    for (let d = 0; d < 4; d++) {
      await sleep(300);
      process.stdout.write('.');
    }
    console.log(' done' + c.reset);
    await sleep(200);

    // Anxiety level
    console.log('\n  ' + c.bold + c.gray + 'ANXIETY LEVEL  ' + c.reset + anxietyBar(anxietyLevel) + '  ' + c.bold + (anxietyLevel >= 8 ? c.red : c.yellow) + `${anxietyLevel}/10` + c.reset);
    await sleep(300);

    // Scenarios
    console.log('\n  ' + c.bold + c.gray + 'WHAT IF...' + c.reset);
    for (let j = 0; j < scenarios.length; j++) {
      await sleep(250);
      const num = c.brightPurple + c.bold + `  ${j + 1}.` + c.reset;
      const text = wrap(scenarios[j], 62, '     ');
      // Print first line with number, rest indented
      const textLines = text.split('\n');
      console.log(num + ' ' + textLines[0].trimStart());
      for (let k = 1; k < textLines.length; k++) {
        console.log(textLines[k]);
      }
    }

    // Bottom line
    await sleep(400);
    console.log('\n  ' + c.bold + c.gray + 'BOTTOM LINE' + c.reset);
    console.log('  ' + c.italic + c.white + wrap(bottomLine, 64, '  ') + c.reset);

    // Share
    await sleep(200);
    console.log('\n  ' + c.gray + c.dim + '📋 [Copy for sharing]' + c.reset);

    // Free tier counter
    const remaining = 3 - (i + 1);
    if (remaining > 0) {
      const dots = '●'.repeat(remaining) + '○'.repeat(3 - remaining);
      console.log('  ' + c.purple + dots + c.reset + c.gray + `  ${remaining} free overthink${remaining === 1 ? '' : 's'} left today` + c.reset);
    } else if (i === 2) {
      console.log('\n  ' + c.bgPurple + c.white + c.bold + '  🔒 Daily limit reached — Upgrade to PRO for $3.99/mo  ' + c.reset);
      await sleep(500);
      console.log('\n  ' + c.brightPurple + c.bold + '  ✦ PRO includes:' + c.reset);
      console.log(c.purple + '    ∞  Unlimited overthinking' + c.reset);
      console.log(c.purple + '    ⚡ Faster responses' + c.reset);
      console.log(c.purple + '    📤 Shareable results' + c.reset);
      console.log(c.purple + '    💜 Support indie dev' + c.reset);
    }

    console.log('\n' + c.gray + '  ' + '─'.repeat(60) + c.reset + '\n');
    await sleep(600);
  }

  // Cost breakdown
  console.log(c.bold + c.gray + '  💰 UNIT ECONOMICS' + c.reset);
  console.log(c.gray + '  Claude Haiku: ~$0.00025 / overthink' + c.reset);
  console.log(c.gray + '  Revenue (after 30% Apple cut): $2.79/user/month' + c.reset);
  console.log(c.gray + '  Break-even: 1 paying user covers ~11,160 overthinks' + c.reset);
  console.log(c.green + c.bold + '  Margin at 100 users: ~99.9%' + c.reset + '\n');
}

runDemo().catch(console.error);
