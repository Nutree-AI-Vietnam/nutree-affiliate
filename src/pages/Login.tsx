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

  const field = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 transition";
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white font-extrabold text-xl shadow-lg">N</div>
          <h1 className="text-2xl font-extrabold text-gray-900">Nutree Affiliates</h1>
          <p className="mt-1 text-sm text-gray-500">Đăng nhập để tiếp tục</p>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-lg border border-gray-100">
          <form className="space-y-4" onSubmit={submit}>
            <label className="block text-sm font-medium text-gray-700">Email
              <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="block text-sm font-medium text-gray-700">Mật khẩu
              <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <button disabled={loading} className="w-full rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
              {loading ? "Đang đăng nhập…" : "Đăng nhập"}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-gray-500">Chưa có tài khoản? <Link className="font-semibold text-green-600 hover:text-green-700" to="/register">Đăng ký</Link></p>
        </div>
      </div>
    </div>
  );
}
