import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/ui/segmented';
import { useProgressTab } from '@/lib/progressTab';
import { Strength } from './progress/Strength';
import { Body } from './progress/Body';

export function Progress() {
  const tab = useProgressTab((s) => s.tab);
  return (
    <Screen title="Progress">
      <Segmented
        className="mt-3"
        value={tab}
        onChange={(t) => useProgressTab.setState({ tab: t })}
        options={[
          { value: 'strength', label: 'Strength' },
          { value: 'body', label: 'Body' },
        ]}
      />
      {tab === 'strength' ? <Strength /> : <Body />}
    </Screen>
  );
}
