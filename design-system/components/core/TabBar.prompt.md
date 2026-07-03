Bottom tab bar, the app's primary navigation. Exactly 4 quiet tabs: הבית (home) · נושאים (topics) · כרטיסיות (flashcards) · עוד (more). Schedule, videos, resources, and settings live under עוד to keep the bar calm.

Rules: shown on top-level screens only; hidden inside focused flows (quiz session, flashcard session, login, schedule setup) where a back/close button in the top bar is the only exit. Active tab = `--primary-soft-text` + weight 700; inactive = `--text-faint`. Screens with the bar need ~88px bottom padding.

```jsx
<TabBar active="home" onNavigate={(key) => router.push(routes[key])} />
```
