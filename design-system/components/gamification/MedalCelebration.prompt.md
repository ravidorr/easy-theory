Celebration modal shown once when the quiz API returns `medals_earned`. Scrim + card pop (`--ease-spring`, scale 0.85→1), gold Medal at the top, title "מדליה חדשה! 🎉" (the ONE allowed emoji on this screen), the medal's description, and a single primary dismiss button.

Rules: show after the answer/summary moment, never interrupting a question; one medal per modal (queue if several); dismiss by button or scrim tap, never auto-dismiss; no confetti or looping animation. Streak milestone descriptions state the achievement warmly without pressure to extend it ("5 ימים ברצף, כל הכבוד!" — never "אל תשברי את הרצף").

```jsx
{earned && <MedalCelebration medal={earned} onClose={() => setEarned(queue.shift())} />}
```
