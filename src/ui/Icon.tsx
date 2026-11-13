import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

import type { ColorRoles } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

export type IconName = ComponentProps<typeof Feather>['name'];

/** Line icons (Feather) on theme colours. Decorative by default; give a label when the icon alone carries meaning. */
export function Icon({
  name,
  size = 20,
  color = 'text',
  label,
}: {
  name: IconName;
  size?: number;
  color?: keyof ColorRoles;
  label?: string;
}) {
  const { colors } = useTheme();
  return (
    <Feather
      name={name}
      size={size}
      color={colors[color]}
      accessible={label !== undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    />
  );
}
