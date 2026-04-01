export default function LoginPage({ username, password, error, onUsernameChange, onPasswordChange, onSubmit }) {
  return (
    <main className="sheet login-shell">
      <section className="login-card" aria-label="Kirish">
        <h1>Kirish</h1>
        <p>Faqat ruxsat etilgan login va parol bilan kirish mumkin.</p>
        <form className="login-form" onSubmit={onSubmit}>
          <label htmlFor="login-username">Login</label>
          <input
            id="login-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder="Login"
            required
          />

          <label htmlFor="login-password">Parol</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Parol"
            required
          />

          {error ? <p className="login-error">{error}</p> : null}

          <button type="submit">Kirish</button>
        </form>
      </section>
    </main>
  )
}
