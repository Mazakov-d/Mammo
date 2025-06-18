import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { PropsWithChildren, createContext, useEffect, useState, useContext } from "react";

type AuthData = {
  session: Session | null;
}

const AuthContext = createContext<AuthData>({
	session: null,
});

export default function AuthProvider({ children }: PropsWithChildren) {
	const [session, setSession] = useState<Session | null>(null);

	useEffect(() => {
		const fetchSession = async () => {
			const { data: { session } } = await supabase.auth.getSession();
			setSession(session);
		}
		fetchSession();
		supabase.auth.onAuthStateChange((event, session) => {
			setSession(session);
		});
	}, []);

	return (
		<AuthContext.Provider value={{ session }}>
			{children}
		</AuthContext.Provider>
	)
}

export const useAuth = () => useContext(AuthContext);
