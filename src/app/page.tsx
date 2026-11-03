import Link from 'next/link';
import ShoreShip from '@/components/ShoreShip';
import styles from './page.module.css';

export default function Home() {
  return (
    <main>
      <ShoreShip />
      <Link href="/tracker" className={styles.open}>
        Open tracker
      </Link>
    </main>
  );
}
