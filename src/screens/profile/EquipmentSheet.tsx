import { ALL_EQUIPMENT } from '@/domain/catalogue';
import type { EquipmentKind } from '@/domain/types';
import { Sheet } from '@/components/ui/sheet';
import { List, Row } from '@/components/ui/card';
import { FieldRow, Switch } from '@/components/ui/field';
import { openSheet } from '@/lib/route';
import { useData } from '@/store/app';
import { Done } from './Done';
import { setProfile } from './setProfile';

const EQUIPMENT_LABEL: Record<EquipmentKind, string> = {
  barbell: 'Barbells & racks',
  dumbbell: 'Dumbbells',
  machine: 'Machines',
  cable: 'Cable stack',
  bodyweight: 'Pull-up bar & dip station',
};

export function EquipmentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const p = data.profile;
  return (
    <Sheet open={open} onClose={onClose} tall title="Equipment" right={<Done onClose={onClose} />}>
      <List>
        {ALL_EQUIPMENT.map((k) => (
          <FieldRow key={k} label={EQUIPMENT_LABEL[k]}>
            <Switch
              label={EQUIPMENT_LABEL[k]}
              checked={p.equipment.includes(k)}
              onChange={(on) => setProfile({ equipment: on ? [...p.equipment, k] : p.equipment.filter((x) => x !== k) })}
            />
          </FieldRow>
        ))}
      </List>
      <div className="mt-3">
        <List>
          <Row
            title="Exercise library"
            subtitle={`${p.excludedExerciseIds.length} excluded · ${data.customExercises.length} custom`}
            onClick={() => openSheet('library')}
            chevron
          />
        </List>
      </div>
    </Sheet>
  );
}
