import Footer from './components/Footer';
export default function App() {
  return (
    <div>
      <img src="/hero.jpg" />
      <div className="card" onClick={() => go()}>מוצר</div>
      <button className="outline-none"><svg viewBox="0 0 24 24"><path d="M0 0" /></svg></button>
      <p className="text-gray-400">מחיר: 120 ₪ + מע"מ</p>
      <button>הוספה לסל</button>
      <a href="/about">לחצו כאן</a>
      <video src="/promo.mp4" autoPlay muted loop />
      <input tabIndex="3" />
      <form onSubmit={send}>
        <input type="email" name="email" placeholder="אימייל" />
        <input type="checkbox" defaultChecked /> אני מאשר/ת לקבל עדכונים ומבצעים
        <button type="submit">שליחה</button>
      </form>
      <Footer />
      <p>[שם העסק]</p>
    </div>
  );
}
const key = "sk_live_51HabcdefghijklmnopQRST";
