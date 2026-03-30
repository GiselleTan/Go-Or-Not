import { InfoIcon } from 'lucide-react';
import { Tooltip } from 'radix-ui';

interface InfoTooltipProps {
  text: string;
  icon?: React.ReactNode;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, icon }) => {
  return (
    <Tooltip.Provider delayDuration={100}>
      <Tooltip.Root>
        <Tooltip.Trigger className='tooltip-container' asChild>
          {icon || <InfoIcon size={16} />}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className='tooltip-text' side='top' align='center'>
            {text}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
