/* ============================================================
   Question bank
   Every answer is written twice: `standard` sounds like a typical
   smart speaker, `adapted` is short, plain and respectful.
   `match` lists patterns; a question matches an entry if any pattern
   is found in it (lower-case, punctuation removed).

   To add a question, copy an entry, give it a new id, and write both
   answers. Keep adapted answers to one to three short sentences.
   ============================================================ */
window.QUESTION_BANK = [
  // ---------- everyday knowledge ----------
  { id:'sky-blue', topic:'Everyday knowledge',
    match:[/why is the sky blue/, /sky (is )?blue/],
    standard:"Great question! Sunlight is made of all colours, and when it hits the air, the tiny gas molecules scatter blue light much more than red light. That scattered blue light reaches your eyes from every direction, so the whole sky looks blue. It's also why sunsets look orange, because the light travels through more air.",
    adapted:"Sunlight contains all colours. The air scatters blue light the most, so the sky looks blue." },
  { id:'leaves', topic:'Everyday knowledge',
    match:[/leaves? (change|turn)/, /autumn colou?rs?/, /fall colou?rs?/],
    standard:"In autumn, trees stop making chlorophyll, the green pigment they use to turn sunlight into food. As the green fades, yellow and orange pigments that were there all along start to show, and some trees also make red pigments. Cooler nights and shorter days speed it all up!",
    adapted:"In autumn, trees stop making their green colour. That lets the yellow and orange colours underneath show through." },
  { id:'rainbow', topic:'Everyday knowledge',
    match:[/rainbow/],
    standard:"A rainbow appears when sunlight shines through raindrops. Each drop bends the light and splits it into its colours, red, orange, yellow, green, blue, indigo and violet. You'll usually see one when the sun is behind you and rain is in front of you.",
    adapted:"Raindrops split sunlight into its colours. You see a rainbow when the sun is behind you and rain is in front of you." },
  { id:'moon-distance', topic:'Everyday knowledge',
    match:[/(how far|distance).*(moon)/, /moon.*(how far|distance)/],
    standard:"The Moon is about 239,000 miles from Earth on average, which is roughly 384,000 kilometres. Light takes a little over a second to make the trip, and the Apollo astronauts took about three days to get there.",
    adapted:"The Moon is about 239,000 miles away from Earth." },
  { id:'capital-france', topic:'Everyday knowledge',
    match:[/capital of france/],
    standard:"The capital of France is Paris. It's also the country's largest city, famous for the Eiffel Tower and the Louvre museum.",
    adapted:"The capital of France is Paris." },
  { id:'hiccups', topic:'Everyday knowledge',
    match:[/hiccups?/],
    standard:"Hiccups are sudden spasms of your diaphragm, the muscle under your lungs. Popular tricks to stop them include sipping cold water slowly, holding your breath for a few seconds, or breathing into a paper bag. If hiccups last more than two days, it's worth checking with a doctor.",
    adapted:"Try sipping cold water slowly or holding your breath for a few seconds. If they last more than two days, see a doctor." },

  // ---------- health and wellbeing (general information only) ----------
  { id:'water', topic:'Health',
    match:[/how much water/, /(drink|glasses of) water/, /stay hydrated/],
    standard:"A common guideline is about six to eight glasses of fluid a day, and tea, milk and juicy foods count too. You may need more when it's hot or when you're active. If you have heart or kidney conditions, your doctor may give you a different amount.",
    adapted:"Most adults need about six to eight glasses of fluid a day. If you have a heart or kidney condition, ask your doctor." },
  { id:'back-stretch', topic:'Health',
    match:[/stretch/, /stiff back/, /back pain/],
    standard:"A gentle one to try is the seated twist. Sit tall in a sturdy chair, place your right hand on the outside of your left knee, and slowly turn your upper body to the left. Hold for a few breaths, then switch sides. Move gently, and stop if anything hurts. For ongoing pain, a doctor or physiotherapist can suggest exercises for you.",
    adapted:"Try a seated twist. Sit tall, hold your left knee with your right hand, and turn gently to the left for a few breaths. Then do the other side, and stop if it hurts." },
  { id:'sleep', topic:'Health',
    match:[/sleep (better|well)/, /trouble sleeping/, /can'?t sleep/, /insomnia/],
    standard:"A few things that help many people: go to bed and get up at the same times each day, get some daylight in the morning, avoid caffeine after lunch, and keep the bedroom cool, dark and quiet. Screens before bed can also make it harder to drift off. If poor sleep goes on for weeks, mention it to your doctor.",
    adapted:"Keep the same bedtime and wake time each day. Avoid caffeine after lunch, and keep your bedroom cool and dark." },
  { id:'walking', topic:'Health',
    match:[/how much (should i )?walk/, /(daily|good) exercise/, /how much exercise/],
    standard:"Health guidelines suggest about 150 minutes of moderate activity a week, like brisk walking, which works out to around 30 minutes on five days. Strength and balance exercises twice a week are great too. Even short walks add up, so start where you're comfortable!",
    adapted:"Aim for about 30 minutes of walking on most days. Short walks add up too." },
  { id:'blood-pressure', topic:'Health',
    match:[/blood pressure/],
    standard:"For most adults, a reading below 120 over 80 is considered normal, and 130 over 80 or higher is considered high. Readings vary through the day, so your doctor will look at several measurements. If you take blood pressure medicine, follow your doctor's targets.",
    adapted:"For most adults, below 120 over 80 is normal. Your doctor can tell you the right target for you." },

  // ---------- food and cooking ----------
  { id:'boil-egg', topic:'Cooking',
    match:[/boil (an |a )?eggs?/, /hard.?boiled/, /soft.?boiled/],
    standard:"Place the eggs in a pan, cover them with cold water, and bring it to a boil. Then turn off the heat, cover the pan, and leave them for about 6 minutes for soft yolks or 10 to 12 minutes for hard-boiled. Cool them in cold water so they're easier to peel.",
    adapted:"Bring the eggs to a boil in water, then turn off the heat. Leave them 6 minutes for soft, or 10 to 12 minutes for hard." },
  { id:'pancakes', topic:'Cooking',
    match:[/pancakes?/],
    standard:"Basic pancakes need one cup of flour, one cup of milk, one egg, a tablespoon of sugar, two teaspoons of baking powder and a pinch of salt. Whisk it together and cook on a lightly oiled pan until bubbles form, then flip!",
    adapted:"You need flour, milk, one egg, a little sugar, baking powder and a pinch of salt." },
  { id:'healthy-breakfast', topic:'Cooking',
    match:[/healthy breakfast/, /what should i (have|eat) for breakfast/, /breakfast ideas?/],
    standard:"Some easy, healthy options are porridge with fruit, whole-grain toast with an egg, or plain yogurt with berries and nuts. Including some protein and fibre in the morning helps keep you full until lunch.",
    adapted:"Porridge with fruit, or whole-grain toast with an egg, are good choices." },
  { id:'rice', topic:'Cooking',
    match:[/cook rice/, /rice.*water/],
    standard:"For white rice, use about two cups of water for every cup of rice. Bring the water to a boil, add the rice and a pinch of salt, cover, and simmer on low for 15 to 18 minutes. Let it rest for five minutes before fluffing it with a fork.",
    adapted:"Use two cups of water for each cup of rice. Simmer it covered on low heat for about 15 minutes." },

  // ---------- technology help ----------
  { id:'screenshot', topic:'Technology',
    match:[/screenshot/],
    standard:"On an iPhone with Face ID, press the side button and the volume-up button at the same time. On most Android phones, press the power button and volume-down together. The picture is saved to your photos.",
    adapted:"On an iPhone, press the side button and volume up together. On most Android phones, press power and volume down." },
  { id:'text-bigger', topic:'Technology',
    match:[/(make|making) (the )?(text|font|writing) (bigger|larger)/, /bigger text/, /larger text/],
    standard:"On an iPhone, go to Settings, then Display and Brightness, then Text Size, and drag the slider. On Android, open Settings, then Display, then Font size. Many apps will follow the new size automatically.",
    adapted:"On an iPhone, open Settings, then Display and Brightness, then Text Size. On Android, open Settings, then Display, then Font size." },
  { id:'scam', topic:'Technology',
    match:[/scam/, /suspicious (call|email|text|message)/, /is this (a )?fraud/],
    standard:"Be careful with any call, email or text that asks for money, gift cards, passwords or bank details, or that says something is urgent. Don't click links or call numbers in the message. Instead, hang up and contact the company or person directly using a number you already trust.",
    adapted:"Never share passwords or bank details with someone who contacts you. Hang up, and call the company on a number you already know." },

  // ---------- fun ----------
  { id:'joke', topic:'Fun',
    match:[/joke/, /make me laugh/, /something funny/],
    standard:"Why don't scientists trust atoms? Because they make up everything! Want another one?",
    adapted:"Why don't scientists trust atoms? Because they make up everything." },
  { id:'fun-fact', topic:'Fun',
    match:[/fun fact/, /tell me something interesting/, /interesting fact/],
    standard:"Here's one: honey never spoils! Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible. Pretty amazing, right?",
    adapted:"Honey never spoils. Honey found in ancient Egyptian tombs was still safe to eat." },
  { id:'who-are-you', topic:'About the assistant',
    match:[/who are you/, /what are you/, /your name/, /are you (a )?(robot|human|person)/],
    standard:"I'm the Everyday Voice Assistant, a research prototype from a class project at UT Dallas. I can answer a set of common questions, set timers and reminders, and tell you the date. What would you like to try?",
    adapted:"I am a voice assistant made for a UT Dallas class study. I can answer common questions, set timers and reminders, and tell you the date." },
];

// Weather is simulated so every participant hears the same forecast.
window.SIMULATED_WEATHER = {
  today:    { desc:'mostly cloudy',            high:66, low:55 },
  tomorrow: { desc:'sunny with a few clouds',  high:72, low:58 },
};
