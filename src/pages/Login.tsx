import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApi } from "../api";
import { saveSession } from "../auth/session";

export function Login() {
  const api = useApi();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const session = await api.login(email, password);
      saveSession(session);
      navigate(session.role === "admin" ? "/admin" : "/pt");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const field = "mt-1 w-full rounded border border-gray-300 px-3 py-2";
  return (
    <div className="mx-auto mt-24 max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Nutree Affiliates</h1>
      <form className="space-y-3" onSubmit={submit}>
        <label className="block text-sm">Email
          <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block text-sm">Mật khẩu
          <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50">
          {loading ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
      <p className="mt-4 text-sm">Chưa có tài khoản? <Link className="underline" to="/register">Đăng ký</Link></p>
    </div>
  );
}
