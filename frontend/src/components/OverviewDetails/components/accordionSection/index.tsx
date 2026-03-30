import { Accordion } from 'radix-ui';
import styles from './styles.module.scss';
import { ChevronDown } from 'lucide-react';

interface AccordionSectionProps {
  title: string;
  children: React.ReactNode;
}

export const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  children,
}) => {
  return (
    <Accordion.Item className={styles.accordionItem} value={title}>
      <Accordion.Header>
        <Accordion.Trigger className={styles.accordionTrigger}>
          {title}
          <ChevronDown className={styles.accordionChevron} />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className={styles.accordionContent}>
        {children}
      </Accordion.Content>
    </Accordion.Item>
  );
};
