import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState, type ReactElement } from 'react';
import { StyleSheet } from 'react-native';

import { scriptFor } from '@/theme/fonts';
import { ThemeProvider } from '@/theme/theme';

import { Banner, Button, FareBreakdown, OtpInput, PhoneField, SegmentedControl, SelectableCard, Text } from '..';

async function renderThemed(ui: ReactElement, mode: 'light' | 'dark' = 'light') {
  return await render(<ThemeProvider initialMode={mode}>{ui}</ThemeProvider>);
}

describe('Button', () => {
  it('fires once per press and exposes its label to screen readers', async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Send code" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('blocks presses and reports busy while loading', async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Request Bike" loading onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Request Bike' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
  });

  it('is announced as disabled', async () => {
    await renderThemed(<Button label="Select a destination" disabled onPress={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Select a destination' })).toBeDisabled();
  });
});

describe('PhoneField', () => {
  function Harness({ onDigits }: { onDigits: (d: string) => void }) {
    const [value, setValue] = useState('');
    return (
      <PhoneField
        testID="phone"
        value={value}
        onChangeDigits={(d) => {
          setValue(d);
          onDigits(d);
        }}
      />
    );
  }

  it('normalises a pasted local number and shows it grouped', async () => {
    const onDigits = jest.fn();
    await renderThemed(<Harness onDigits={onDigits} />);
    await fireEvent.changeText(screen.getByTestId('phone'), '01712345678');
    expect(onDigits).toHaveBeenLastCalledWith('1712345678');
    expect(screen.getByTestId('phone').props.value).toBe('17 1234 5678');
  });
});

describe('OtpInput', () => {
  it('reports completion once all six digits are entered, ignoring non-digits', async () => {
    const onComplete = jest.fn();
    const onChange = jest.fn();
    await renderThemed(<OtpInput testID="otp" value="" onChange={onChange} onComplete={onComplete} />);
    await fireEvent.changeText(screen.getByTestId('otp'), '48-2 913');
    expect(onChange).toHaveBeenCalledWith('482913');
    expect(onComplete).toHaveBeenCalledWith('482913');
  });

  it('does not complete early', async () => {
    const onComplete = jest.fn();
    await renderThemed(<OtpInput testID="otp" value="" onChange={() => undefined} onComplete={onComplete} />);
    await fireEvent.changeText(screen.getByTestId('otp'), '482');
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe('selection controls', () => {
  it('SegmentedControl marks the selected tab and reports changes', async () => {
    const onChange = jest.fn();
    await renderThemed(
      <SegmentedControl
        accessibilityLabel="Save as"
        segments={[
          { value: 'home', label: 'Home' },
          { value: 'office', label: 'Office' },
        ]}
        value="office"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Office' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Home' }));
    expect(onChange).toHaveBeenCalledWith('home');
    await fireEvent.press(screen.getByRole('tab', { name: 'Office' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('SelectableCard is a radio with a checked state', async () => {
    await renderThemed(
      <SelectableCard selected onPress={() => undefined} accessibilityLabel="Bike, 2 minutes">
        <Text>Bike</Text>
      </SelectableCard>,
    );
    expect(screen.getByRole('radio', { name: 'Bike, 2 minutes' })).toBeChecked();
  });
});

describe('status and ride pieces', () => {
  it('Banner for a problem is announced as an alert', async () => {
    await renderThemed(<Banner tone="danger" body="Location is off" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Location is off/);
  });

  it('FareBreakdown shows server amounts as taka with discounts as negatives', async () => {
    await renderThemed(
      <FareBreakdown
        lines={[
          { label: 'Base fare', amount: '40.00' },
          { label: 'Promo', amount: '10.00', kind: 'discount' },
          { label: 'Total', amount: '190.00', kind: 'total' },
        ]}
      />,
    );
    expect(screen.getByLabelText('Base fare, ৳40')).toBeOnTheScreen();
    expect(screen.getByText('−৳10')).toBeOnTheScreen();
    expect(screen.getByLabelText('Total, ৳190')).toBeOnTheScreen();
  });

  it('Text switches to the Bengali family for Bengali text and caps font scaling', async () => {
    await renderThemed(<Text testID="t">বাংলা</Text>);
    const node = screen.getByTestId('t');
    expect(StyleSheet.flatten(node.props.style).fontFamily).toMatch(/^HindSiliguri_/);
    expect(node.props.maxFontSizeMultiplier).toBe(1.3);
  });

  it('Text uses theme colours in dark mode', async () => {
    await renderThemed(<Text testID="t">Hello</Text>, 'dark');
    expect(StyleSheet.flatten(screen.getByTestId('t').props.style)).toMatchObject({ color: '#E8F5EE', fontFamily: 'Inter_400Regular' });
  });
});

describe('script detection', () => {
  it('keeps Latin text in Inter even when the UI language is Bengali', () => {
    expect(scriptFor('bn', 'House 42, Road 11')).toBe('latin');
    expect(scriptFor('bn', 'বনানী')).toBe('bengali');
    expect(scriptFor('en', '৳190')).toBe('bengali');
    expect(scriptFor('bn')).toBe('bengali');
    expect(scriptFor('en')).toBe('latin');
  });
});
