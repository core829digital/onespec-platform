import Image from "next/image";
import styles from "./brand-cube.module.css";

const FACE_CLASSES = [
  styles.front,
  styles.back,
  styles.right,
  styles.left,
  styles.top,
  styles.bottom,
];

export function BrandCube({ size = 90 }: { size?: number }) {
  return (
    <div className={styles.container} style={{ "--cube": `${size}px` } as React.CSSProperties} aria-hidden="true">
      <div className={styles.cube}>
        {FACE_CLASSES.map((c) => (
          <div key={c} className={`${styles.face} ${c}`}>
            <Image
              priority
              src="/onespec-logo.png"
              alt=""
              width={2000}
              height={700}
              className={styles.wordmark}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
