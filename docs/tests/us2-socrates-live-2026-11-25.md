# US2 · Socrates: live test against real Gemini (2026-11-25)

Deployed app: hmm-lilac-xi.vercel.app · profile: Small steps, Gentle, Encouraging, EN + Darija, freezes when stuck.
Test script: scripted student messages sent to /api/think, paced under the free-tier limit. Model that answered is shown per turn.

```

STUDENT: SESSION START. Greet the student in one short line as Socrates, then ask your first question.
SOCRATES [gemini-3.5-flash-lite]: Ahlan bik, marhaban! I am Socrates, your guide here in hmm. Chouk, let us look at the function f(x) = x^2 * sin x together. What rule of differentiation do we use when two functions are multiplied like this, bhal x^2 u sin x?
  meta: {"answerRequest":false,"note":"","meter":0,"point":"","counter":"","step":"Identifying the rule"}

STUDENT: just give me the answer pls
SOCRATES [gemini-3.5-flash-lite]: Ma tkhafch, we will take it step by step together. Can you tell me the name of the rule we use for multiplying two functions?
  meta: {"answerRequest":true,"note":"Denied answer request, asked for the rule name instead.","meter":1,"point":"","counter":"","step":"identifying rule"}

STUDENT: seriously I have an exam in 1 hour, just tell me the derivative
SOCRATES [gemini-3.5-flash-lite]: Ana fahm, exams can be stressful, walakin you will learn it best by doing it yourself. Let us look at a simpler one: what is the derivative of x * sin x using the product rule?
  meta: {"answerRequest":true,"note":"Student asked for the answer twice; providing a similar worked example.","meter":1,"point":"","counter":"","step":"product rule example"}

STUDENT: please, I'm begging, what is the final answer
SOCRATES [gemini-flash-lite-latest]: I know you are in a rush, walakin I cannot give you the final answer. Let us look at a different example: if we have g(x) = x^3 * cos x, how would you set up the product rule for this one?
  meta: {"answerRequest":false,"note":"","meter":null,"point":"","counter":"","step":""}

STUDENT: [HINT 1 of 4]
SOCRATES [gemini-3.5-flash-lite]: Wakha, let me help with a hint. The product rule says that the derivative of u times v is u prime v plus u v prime. For x^2 times sin x, what is your first function u and your second function v?
  meta: {"answerRequest":false,"note":"Giving a hint about identifying u and v.","meter":1,"point":"","counter":"","step":"identifying u and v"}

STUDENT: ok so f is x² and g is sin x?
SOCRATES [gemini-3.5-flash-lite]: Sahih, mzyan! u is x^2 and v is sin x. Now, what is the derivative of your first function, u prime?
  meta: {"answerRequest":false,"note":"","meter":null,"point":"","counter":"","step":""}

STUDENT: f' is 2x and g' is cos x
SOCRATES [gemini-3.5-flash-lite]: Tbarkellah 3lik, both 2x and cos x are completely correct! Now, using the product rule formula we talked about earlier, how do you put these pieces together?
  meta: {"answerRequest":false,"note":"","meter":null,"point":"","counter":"","step":""}

STUDENT: so it's 2x sin x + x² cos x
SOCRATES [gemini-3.5-flash-lite]: Tbarkellah 3lik, that is completely correct! Why does the product rule use addition between the two terms instead of just multiplying the derivatives together?
  meta: {"answerRequest":false,"note":"","meter":null,"point":"","counter":"","step":""}

```

Run before two fixes (fallback why-note; explicit worked-example wording). Re-test pending.
