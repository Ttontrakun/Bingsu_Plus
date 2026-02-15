import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { HiOutlineMail } from 'react-icons/hi';
import bingsuLogo from '../assets/images/หน่องบิงไม่มีพื้นละ.png';
import ntLogo from '../assets/images/NT_Logo.png';

function Verifying() {
  const navigate = useNavigate();
  useEffect(() => {
    // This app now uses ask_AA auth (email + password) and does not require email verification flow.
    const id = setTimeout(() => navigate('/auth'), 1200);
    return () => clearTimeout(id);
  }, [navigate]);

  return (
    <div className='relative flex items-center justify-center min-h-screen bg-[#D9D9D9]'>
      {/* NT Logo at top-left corner */}
      <div className="absolute top-5 left-5 z-10 hidden md:block">
        <a href="https://ntplc.co.th/home" target="_blank" rel="noopener noreferrer">
          <img src={ntLogo} alt="NT Logo" className="max-w-[150px] max-h-[150px] object-contain hover:opacity-80 transition-opacity cursor-pointer" />
        </a>
      </div>

      {/* กลางจอ */}
      <div className="relative w-full max-w-[380px] m-4">
        {/* BingSu Logo at center top above card */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <img src={bingsuLogo} alt="BingSu Logo" className="h-12 w-12 object-cover rounded-full" />
          <h2 className="text-2xl font-bold text-zinc-800">BingSu</h2>
        </div>
        {/* Card */}
        <div className="relative w-full rounded-[2rem] bg-white p-12 shadow-[0_10px_30px_rgba(0,0,0,0.08)] min-h-[400px] flex flex-col justify-center"
          style={{
            border: '4px solid rgba(252,186,3,0.95)',
            boxShadow: '0 0 20px rgba(252,186,3,0.3), 0 10px 30px rgba(0,0,0,0.08)'
          }}>
          <div className="flex flex-col items-center">
            <div className="flex justify-center mb-6">
              <HiOutlineMail className="text-7xl text-gray-700" />
            </div>

            <h2 className="text-sm font-semibold text-gray-800 mb-3 text-center">
              Redirecting…
            </h2>

            <p className="text-xs text-gray-500 leading-relaxed mb-6 text-center">
              หน้านี้ไม่ถูกใช้แล้ว (ระบบล็อกอินแบบอีเมล/รหัสผ่าน)
            </p>

            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="text-xs text-gray-500 hover:text-yellow-500 hover:underline transition-all duration-400"
            >
              Go to Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Verifying;
