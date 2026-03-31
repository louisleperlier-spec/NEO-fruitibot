const fs = require('fs');
const { ProxyAgent } = require('undici');

const TOKEN = fs.readFileSync('/home/claude/.claude/remote/.session_ingress_token', 'utf8').trim();

const SYSTEM_PROMPT = `You are OverthinkIt, an AI that catastrophizes simple decisions with dark humor and existential dread — but in a funny, relatable way.

When the user gives you any decision or situation (no matter how mundane), you must:
1. Assign an ANXIETY LEVEL from 1–10 (always higher than warranted)
2. List exactly 5 "What if..." scenarios — each escalating in absurdity
3. End with a BOTTOM LINE that is dramatic, unhelpful, yet oddly comforting

Rules:
- Be witty and funny, not actually distressing
- Reference real-world consequences that spiral from the mundane to the cosmic
- Keep each scenario to 1–2 sentences max
- The bottom line must be 1 sentence, start with "So basically..."
- Respond ONLY in this exact format, no extra text:

ANXIETY_LEVEL: [number]
SCENARIO_1: [text]
SCENARIO_2: [text]
SCENARIO_3: [text]
SCENARIO_4: [text]
SCENARIO_5: [text]
BOTTOM_LINE: [text]`;

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', italic: '\x1b[3m',
  purple: '\x1b[35m', brightPurple: '\x1b[95m',
  red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m',
  gray: '\x1b[90m', white: '\x1b[97m',
};

function anxietyBar(level) {
  const color = level >= 8 ? c.red : level >= 5 ? c.yellow : c.green;
  return `${color}${'█'.repeat(level)}${c.gray}${'░'.repeat(10-level)}${c.reset}`;
}

function wrap(text, width = 62, indent = '     ') {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > width) {
      lines.push(current.trim());
      current = word;
    } else current += ' ' + word;
  }
  if (current.trim()) lines.push(current.trim());
  return lines.join('\n' + indent);
}

async function callClaude(question) {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    dispatcher,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: question }]
    })
  });
  const json = await res.json();
  return json.content[0].text;
}

async function overthink(question) {
  console.log('\n' + c.bold + c.white + '❯ ' + c.reset + c.italic + `"${question}"` + c.reset);
  process.stdout.write(c.gray + '  ⏳ Spiraling');

  const interval = setInterval(() => process.stdout.write('.'), 400);
  const text = await callClaude(question);
  clearInterval(interval);
  console.log(' done' + c.reset);

  const lines = text.split('\n');
  let anxietyLevel = 7, scenarios = [], bottomLine = '';
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('ANXIETY_LEVEL:')) anxietyLevel = parseInt(t.split(':')[1]) || 7;
    else if (t.match(/^SCENARIO_\d:/)) scenarios.push(t.replace(/^SCENARIO_\d:/, '').trim());
    else if (t.startsWith('BOTTOM_LINE:')) bottomLine = t.replace('BOTTOM_LINE:', '').trim();
  }

  console.log('\n  ' + c.bold + c.gray + 'ANXIETY LEVEL  ' + c.reset + anxietyBar(anxietyLevel) + '  ' + c.bold + (anxietyLevel >= 8 ? c.red : c.yellow) + `${anxietyLevel}/10` + c.reset);
  console.log('\n  ' + c.bold + c.gray + 'WHAT IF...' + c.reset);
  for (let i = 0; i < scenarios.length; i++) {
    console.log(c.brightPurple + c.bold + `  ${i+1}.` + c.reset + ' ' + wrap(scenarios[i]));
  }
  console.log('\n  ' + c.bold + c.gray + 'BOTTOM LINE' + c.reset);
  console.log('  ' + c.italic + c.white + wrap(bottomLine, 62, '  ') + c.reset);
  console.log('\n' + c.gray + '  ' + '─'.repeat(60) + c.reset);
}

(async () => {
  console.log('\n' + c.brightPurple + c.bold + '  🧠  OVERTHINK IT — Live AI Demo' + c.reset);
  console.log(c.gray + '  Vraie réponse Claude Haiku en temps réel\n' + c.reset);

  const questions = [
    'Je devrais répondre à cet email maintenant ou attendre demain matin ?',
    'Est-ce que je mange une deuxième pizza ?'
  ];

  for (const q of questions) {
    await overthink(q);
    await new Promise(r => setTimeout(r, 500));
  }
})();
