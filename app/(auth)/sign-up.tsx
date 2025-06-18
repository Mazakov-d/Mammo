import { View, StyleSheet, TextInput, Text, Alert, Button } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useState } from 'react';
import { Colors } from '@/constants/Colors';
import { Link, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
	const [showPassword, setShowPassword] = useState(false);
	const [password, setPassword] = useState('');
	const [email, setEmail] = useState('');
	const [loading, setLoading] = useState(false);

	const handleSignUp = async () => {
		setLoading(true);
		const { error, data } = await supabase.auth.signUp({
			email,
			password,
		});
		if (data)
			Alert.alert(
				'Success',
				'Veuillez vérifier votre email pour confirmer votre inscription.'
			);
		if (error) Alert.alert('Error', error.message);
		setLoading(false);
	};

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: 'Inscription' }} />
			<View style={styles.inputView}>
				<Text style={styles.inputLabel}>Email :</Text>
				<TextInput
					style={styles.emailInput}
					placeholder="test@test.fr"
					keyboardType="email-address"
					onChangeText={setEmail}
					value={email}
					autoCapitalize="none"
				/>
			</View>
			<View style={styles.inputView}>
				<Text style={styles.inputLabel}>Password :</Text>
				<View style={styles.secureView}>
					<TextInput
						style={styles.secureInput}
						secureTextEntry={!showPassword}
						onChangeText={setPassword}
						value={password}
					/>
					<FontAwesome6
						onPress={() => setShowPassword(!showPassword)}
						name={showPassword ? 'eye' : 'eye-slash'}
						size={20}
						color="black"
						style={{ marginRight: 5 }}
					/>
				</View>
			</View>

			<Button
				title={loading ? 'Inscription ...' : 'Inscription'}
				onPress={handleSignUp}
			/>
			<Link
				href={'/sign-in'}
				asChild>
				<Button title="Déjà un compte ?" />
			</Link>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'center',
		gap: 10,
		padding: 10,
	},
	inputView: {
		gap: 5,
	},
	inputLabel: {
		color: 'gray',
		fontSize: 16,
	},
	emailInput: {
		borderWidth: 1,
		borderColor: 'black',
		borderRadius: 10,
		height: 40,
		padding: 10,
	},
	secureView: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		borderWidth: 1,
		borderRadius: 10,
		height: 40,
	},
	secureInput: {
		borderColor: 'black',
		width: '80%',
		padding: 10,
	},
	textButton: {
		alignSelf: 'center',
		fontWeight: 'bold',
		color: Colors.light.tint,
		marginVertical: 10,
	},
});