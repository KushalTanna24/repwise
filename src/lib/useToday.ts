import { useEffect, useState } from 'react';
import dayjs from 'dayjs';

const read = () => dayjs().format('YYYY-MM-DD');

/** Local date that rolls over at midnight, also after the app returns from the background. */
export function useToday(): string {
  const [today, setToday] = useState(read);
  useEffect(() => {
    const tick = () => setToday(read());
    const id = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return today;
}
