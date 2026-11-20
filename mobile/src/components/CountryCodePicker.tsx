import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { getDefaultCountryCallingCode, searchCountryCallingCodeOptions, type CountryCallingCodeOption } from "../phone/countryPickerData";
import { styles, theme } from "../styles";

type CountryCodePickerProps = {
  value: CountryCallingCodeOption;
  onChange: (option: CountryCallingCodeOption) => void;
  accessibilityLabel?: string;
};

export { getDefaultCountryCallingCode };

export function CountryCodePicker({ accessibilityLabel = "Country code dropdown", onChange, value }: CountryCodePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = useMemo(() => searchCountryCallingCodeOptions(query), [query]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  return <>
    <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={styles.dropdownBox}>
      <Text style={styles.dropdownValue}>{value.flag} {value.name} ({value.dialCode})</Text>
      <Text style={styles.dropdownChevron}>⌄</Text>
    </Pressable>
    {open ? <Modal animationType="slide" onRequestClose={close} transparent>
      <View style={styles.projectSheetBackdrop}>
      <View style={styles.countryPickerSheet} testID="country-code-picker-sheet">
      <View style={styles.countryPickerHeader}>
        <Text style={styles.heading}>Choose country code</Text>
        <Pressable accessibilityLabel="Cancel country code picker" accessibilityRole="button" onPress={close} style={styles.countryPickerCancel}><Text style={styles.countryPickerCancelText}>Cancel</Text></Pressable>
      </View>
      <TextInput autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Search country code" autoFocus clearButtonMode="while-editing" onChangeText={setQuery} placeholder="Search country, code or dial code" placeholderTextColor={theme.colors.placeholder} style={styles.countryPickerSearch} value={query} />
      <ScrollView keyboardShouldPersistTaps="handled" style={styles.countryPickerList}>
        {options.map((option) => {
          const selected = option.iso === value.iso;
          return <Pressable accessibilityLabel={`Country code ${option.name} ${option.dialCode}`} accessibilityRole="button" accessibilityState={{ selected }} key={option.iso} onPress={() => { onChange(option); close(); }} style={[styles.countryPickerOption, selected && styles.countryPickerOptionSelected]}>
            <Text style={styles.countryPickerFlag}>{option.flag}</Text>
            <Text style={styles.countryPickerName}>{option.name}</Text>
            <Text style={styles.countryPickerDialCode}>{option.dialCode}</Text>
          </Pressable>;
        })}
        {options.length === 0 ? <Text style={styles.countryPickerEmpty}>No country codes found.</Text> : null}
      </ScrollView>
      </View>
      </View>
    </Modal> : null}
  </>;
}
