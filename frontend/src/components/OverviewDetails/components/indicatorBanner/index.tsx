import styles from './styles.module.scss';
import clsx from 'classnames';

interface IndicatorBannerProps {
  recommendation: 'GO' | 'MAYBE' | 'NO_GO';
  text: string;
}
export const IndicatorBanner: React.FC<IndicatorBannerProps> = ({
  recommendation,
  text,
}) => {
  return (
    <div
      className={clsx(
        styles.baseBanner,
        recommendation === 'GO' && styles.go,
        recommendation === 'MAYBE' && styles.maybe,
        recommendation === 'NO_GO' && styles.noGo,
      )}
    >
      <p>{text}</p>
    </div>
  );
};
