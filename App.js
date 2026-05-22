import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  query,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './src/config/firebase';

const services = [
  { name: 'Wash', icon: '🧺', price: 70, description: 'Regular washing service' },
  { name: 'Dry', icon: '🌬️', price: 60, description: 'Machine drying service' },
  { name: 'Fold', icon: '👕', price: 40, description: 'Clean folding service' },
  { name: 'Wash + Dry + Fold', icon: '✨', price: 150, description: 'Complete laundry package' },
];

const statusOptions = ['Pending', 'Ongoing', 'Completed', 'Cancelled'];
const paymentOptions = ['Unpaid', 'Paid'];

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoadingUser(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async user => {
      setCurrentUser(user);
      if (!user) {
        setProfile(null);
        setLoadingUser(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const snapshot = await getDoc(userRef);

        if (snapshot.exists()) {
          setProfile({ id: snapshot.id, ...snapshot.data() });
        } else {
          const defaultProfile = {
            name: user.email?.split('@')[0] || 'Customer',
            email: user.email,
            phone: '',
            role: 'customer',
            createdAt: serverTimestamp(),
          };
          await setDoc(userRef, defaultProfile);
          setProfile({ id: user.uid, ...defaultProfile });
        }
      } catch (error) {
        Alert.alert('Profile Error', error.message);
      } finally {
        setLoadingUser(false);
      }
    });

    return unsubscribe;
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  if (!isFirebaseConfigured) {
    return <FirebaseSetupScreen />;
  }

  if (loadingUser) {
    return <LoadingScreen message="Checking account..." />;
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  if (!profile) {
    return <LoadingScreen message="Loading profile..." />;
  }

  return profile.role === 'staff' ? (
    <StaffScreen user={currentUser} profile={profile} />
  ) : (
    <CustomerScreen user={currentUser} profile={profile} />
  );
}

function SplashScreen() {
  return (
    <SafeAreaView style={styles.splashContainer}>
      <StatusBar style="light" />
      <View style={styles.logoCircle}>
        <Text style={styles.logoText}>🧺</Text>
      </View>
      <Text style={styles.splashTitle}>Laundry Appointment</Text>
      <Text style={styles.splashSubtitle}>Book. Wash. Relax.</Text>
      <ActivityIndicator color="#ffffff" size="large" style={{ marginTop: 28 }} />
    </SafeAreaView>
  );
}

function FirebaseSetupScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.centerContent}>
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚙️</Text>
          <Text style={styles.title}>Firebase setup needed</Text>
          <Text style={styles.mutedText}>
            Open src/config/firebase.js and paste your Firebase web app configuration. After that, run the app again.
          </Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>src/config/firebase.js</Text>
            <Text style={styles.codeText}>apiKey: 'your-api-key'</Text>
            <Text style={styles.codeText}>projectId: 'your-project-id'</Text>
            <Text style={styles.codeText}>appId: 'your-app-id'</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LoadingScreen({ message }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.mutedText}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

function AuthScreen() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    if (isRegistering && !name.trim()) {
      setError('Full name is required.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isRegistering) {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await setDoc(doc(db, 'users', credential.user.uid), {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          role,
          createdAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (firebaseError) {
      setError(cleanFirebaseError(firebaseError.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.brandHeader}>
            <View style={styles.smallLogoCircle}>
              <Text style={styles.smallLogoText}>🧺</Text>
            </View>
            <Text style={styles.appName}>Laundry Appointment</Text>
            <Text style={styles.appTagline}>Easy scheduling for customers and laundry staff</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>{isRegistering ? 'Create Account' : 'Welcome Back'}</Text>
            <Text style={styles.mutedText}>
              {isRegistering ? 'Register as customer or staff for demo use.' : 'Login to manage laundry bookings.'}
            </Text>

            {isRegistering && (
              <>
                <Input label="Full Name" value={name} onChangeText={setName} placeholder="Juan Dela Cruz" />
                <Input label="Phone Number" value={phone} onChangeText={setPhone} placeholder="09XXXXXXXXX" keyboardType="phone-pad" />
                <Text style={styles.inputLabel}>Account Type</Text>
                <View style={styles.segmentRow}>
                  <ChoiceButton title="Customer" active={role === 'customer'} onPress={() => setRole('customer')} />
                  <ChoiceButton title="Staff" active={role === 'staff'} onPress={() => setRole('staff')} />
                </View>
              </>
            )}

            <Input label="Email" value={email} onChangeText={setEmail} placeholder="sample@email.com" keyboardType="email-address" autoCapitalize="none" />
            <Input label="Password" value={password} onChangeText={setPassword} placeholder="Minimum 6 characters" secureTextEntry />

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <PrimaryButton title={loading ? 'Please wait...' : isRegistering ? 'Sign Up' : 'Login'} onPress={submit} disabled={loading} />

            <Pressable onPress={() => setIsRegistering(!isRegistering)} style={styles.linkButton}>
              <Text style={styles.linkText}>
                {isRegistering ? 'Already have an account? Login' : 'No account yet? Create one'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CustomerScreen({ user, profile }) {
  const [tab, setTab] = useState('book');

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <Header title="Customer Panel" subtitle={`Hello, ${profile.name || user.email}`} />
      <View style={styles.tabRow}>
        <TabButton title="Book" active={tab === 'book'} onPress={() => setTab('book')} />
        <TabButton title="Appointments" active={tab === 'appointments'} onPress={() => setTab('appointments')} />
        <TabButton title="Profile" active={tab === 'profile'} onPress={() => setTab('profile')} />
      </View>
      {tab === 'book' && <BookingForm user={user} profile={profile} />}
      {tab === 'appointments' && <CustomerAppointments user={user} />}
      {tab === 'profile' && <ProfileScreen profile={profile} user={user} />}
    </SafeAreaView>
  );
}

function StaffScreen({ user, profile }) {
  const [tab, setTab] = useState('dashboard');

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <Header title="Staff Panel" subtitle={`Welcome, ${profile.name || user.email}`} />
      <View style={styles.tabRow}>
        <TabButton title="Dashboard" active={tab === 'dashboard'} onPress={() => setTab('dashboard')} />
        <TabButton title="Appointments" active={tab === 'appointments'} onPress={() => setTab('appointments')} />
        <TabButton title="Profile" active={tab === 'profile'} onPress={() => setTab('profile')} />
      </View>
      {tab === 'dashboard' && <StaffDashboard />}
      {tab === 'appointments' && <StaffAppointments />}
      {tab === 'profile' && <ProfileScreen profile={profile} user={user} />}
    </SafeAreaView>
  );
}

function Header({ title, subtitle }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.headerBadge}>
        <Text style={styles.headerBadgeText}>🧼</Text>
      </View>
    </View>
  );
}

function BookingForm({ user, profile }) {
  const [selectedService, setSelectedService] = useState(services[0]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [kilos, setKilos] = useState('1');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const totalPrice = useMemo(() => {
    const weight = Number(kilos) || 1;
    return selectedService.price * weight;
  }, [selectedService, kilos]);

  const submitBooking = async () => {
    if (!date.trim() || !time.trim()) {
      Alert.alert('Missing Details', 'Please enter date and time.');
      return;
    }

    if ((Number(kilos) || 0) <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid number of kilos.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'appointments'), {
        userId: user.uid,
        userEmail: user.email,
        customerName: profile.name || user.email,
        phone: profile.phone || '',
        service: selectedService.name,
        serviceIcon: selectedService.icon,
        pricePerKilo: selectedService.price,
        kilos: Number(kilos),
        totalPrice,
        date: date.trim(),
        time: time.trim(),
        notes: notes.trim(),
        status: 'Pending',
        paymentStatus: 'Unpaid',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setDate('');
      setTime('');
      setKilos('1');
      setNotes('');
      setSelectedService(services[0]);
      Alert.alert('Booking Confirmed', 'Your laundry appointment has been saved.');
    } catch (error) {
      Alert.alert('Booking Error', cleanFirebaseError(error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>Choose Service</Text>
      <View style={styles.serviceGrid}>
        {services.map(service => (
          <Pressable
            key={service.name}
            onPress={() => setSelectedService(service)}
            style={[styles.serviceCard, selectedService.name === service.name && styles.serviceCardActive]}
          >
            <Text style={styles.serviceIcon}>{service.icon}</Text>
            <Text style={styles.serviceName}>{service.name}</Text>
            <Text style={styles.serviceDescription}>{service.description}</Text>
            <Text style={styles.servicePrice}>₱{service.price}/kg</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Appointment Details</Text>
        <Input label="Date" value={date} onChangeText={setDate} placeholder="Example: 2026-05-25" />
        <Input label="Time" value={time} onChangeText={setTime} placeholder="Example: 10:30 AM" />
        <Input label="Kilos" value={kilos} onChangeText={setKilos} placeholder="Example: 3" keyboardType="numeric" />
        <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Special instructions" multiline />

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Estimated Total</Text>
          <Text style={styles.totalAmount}>₱{totalPrice.toFixed(2)}</Text>
        </View>

        <PrimaryButton title={loading ? 'Saving...' : 'Confirm Appointment'} onPress={submitBooking} disabled={loading} />
      </View>
    </ScrollView>
  );
}

function CustomerAppointments({ user }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const appointmentQuery = query(collection(db, 'appointments'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(
      appointmentQuery,
      snapshot => {
        const data = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
        setAppointments(sortAppointments(data));
        setLoading(false);
      },
      error => {
        Alert.alert('Load Error', cleanFirebaseError(error.message));
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user.uid]);

  const cancelAppointment = appointment => {
    if (appointment.status !== 'Pending') {
      Alert.alert('Cannot Cancel', 'Only pending appointments can be cancelled.');
      return;
    }

    Alert.alert('Cancel Appointment', 'Are you sure you want to cancel this appointment?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          await updateDoc(doc(db, 'appointments', appointment.id), {
            status: 'Cancelled',
            updatedAt: serverTimestamp(),
          });
        },
      },
    ]);
  };

  if (loading) {
    return <LoadingScreen message="Loading appointments..." />;
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>My Appointments</Text>
      {appointments.length === 0 ? (
        <EmptyState title="No appointments yet" subtitle="Create your first booking from the Book tab." />
      ) : (
        appointments.map(appointment => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            footer={
              appointment.status === 'Pending' ? (
                <OutlineButton title="Cancel Appointment" onPress={() => cancelAppointment(appointment)} danger />
              ) : null
            }
          />
        ))
      )}
    </ScrollView>
  );
}

function StaffDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'appointments'),
      snapshot => {
        const data = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
        setAppointments(data);
        setLoading(false);
      },
      error => {
        Alert.alert('Load Error', cleanFirebaseError(error.message));
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const stats = useMemo(() => {
    const todayText = new Date().toISOString().slice(0, 10);
    return {
      total: appointments.length,
      pending: appointments.filter(item => item.status === 'Pending').length,
      ongoing: appointments.filter(item => item.status === 'Ongoing').length,
      completed: appointments.filter(item => item.status === 'Completed').length,
      today: appointments.filter(item => item.date === todayText).length,
      sales: appointments
        .filter(item => item.paymentStatus === 'Paid')
        .reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0),
    };
  }, [appointments]);

  if (loading) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Appointment Overview</Text>
      <View style={styles.statsGrid}>
        <StatCard label="Total" value={stats.total} icon="📋" />
        <StatCard label="Today" value={stats.today} icon="📅" />
        <StatCard label="Pending" value={stats.pending} icon="⏳" />
        <StatCard label="Ongoing" value={stats.ongoing} icon="🫧" />
        <StatCard label="Completed" value={stats.completed} icon="✅" />
        <StatCard label="Paid Sales" value={`₱${stats.sales.toFixed(0)}`} icon="💰" />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Staff Functions</Text>
        <Text style={styles.featureText}>• View all customer appointments</Text>
        <Text style={styles.featureText}>• Update appointment status</Text>
        <Text style={styles.featureText}>• Mark payment as paid or unpaid</Text>
        <Text style={styles.featureText}>• Delete incorrect appointment records</Text>
      </View>
    </ScrollView>
  );
}

function StaffAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'appointments'),
      snapshot => {
        const data = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
        setAppointments(sortAppointments(data));
        setLoading(false);
      },
      error => {
        Alert.alert('Load Error', cleanFirebaseError(error.message));
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const updateStatus = async (appointment, status) => {
    try {
      await updateDoc(doc(db, 'appointments', appointment.id), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      Alert.alert('Update Error', cleanFirebaseError(error.message));
    }
  };

  const updatePayment = async (appointment, paymentStatus) => {
    try {
      await updateDoc(doc(db, 'appointments', appointment.id), {
        paymentStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      Alert.alert('Update Error', cleanFirebaseError(error.message));
    }
  };

  const removeAppointment = appointment => {
    Alert.alert('Delete Appointment', 'This will permanently remove the appointment record.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, 'appointments', appointment.id));
        },
      },
    ]);
  };

  if (loading) {
    return <LoadingScreen message="Loading appointments..." />;
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>All Appointments</Text>
      {appointments.length === 0 ? (
        <EmptyState title="No appointments found" subtitle="Customer bookings will appear here." />
      ) : (
        appointments.map(appointment => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            showCustomer
            footer={
              <View>
                <Text style={styles.inputLabel}>Update Status</Text>
                <View style={styles.wrapRow}>
                  {statusOptions.map(status => (
                    <SmallChip
                      key={status}
                      title={status}
                      active={appointment.status === status}
                      onPress={() => updateStatus(appointment, status)}
                    />
                  ))}
                </View>
                <Text style={styles.inputLabel}>Payment</Text>
                <View style={styles.wrapRow}>
                  {paymentOptions.map(payment => (
                    <SmallChip
                      key={payment}
                      title={payment}
                      active={appointment.paymentStatus === payment}
                      onPress={() => updatePayment(appointment, payment)}
                    />
                  ))}
                </View>
                <OutlineButton title="Delete Record" onPress={() => removeAppointment(appointment)} danger />
              </View>
            }
          />
        ))
      )}
    </ScrollView>
  );
}

function ProfileScreen({ profile, user }) {
  const logout = async () => {
    await signOut(auth);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>{profile.role === 'staff' ? '🧑‍💼' : '🙂'}</Text>
        </View>
        <Text style={[styles.title, { textAlign: 'center' }]}>{profile.name || 'No name'}</Text>
        <Text style={[styles.mutedText, { textAlign: 'center' }]}>{user.email}</Text>
        <View style={styles.profileInfoBox}>
          <Text style={styles.profileInfoLabel}>Role</Text>
          <Text style={styles.profileInfoValue}>{profile.role === 'staff' ? 'Laundry Staff' : 'Customer'}</Text>
        </View>
        <View style={styles.profileInfoBox}>
          <Text style={styles.profileInfoLabel}>Phone</Text>
          <Text style={styles.profileInfoValue}>{profile.phone || 'Not added'}</Text>
        </View>
        <PrimaryButton title="Logout" onPress={logout} />
      </View>
    </ScrollView>
  );
}

function AppointmentCard({ appointment, footer, showCustomer }) {
  return (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.appointmentTitle}>
            {appointment.serviceIcon || '🧺'} {appointment.service}
          </Text>
          {showCustomer && <Text style={styles.mutedText}>{appointment.customerName}</Text>}
        </View>
        <StatusBadge status={appointment.status} />
      </View>

      <View style={styles.detailGrid}>
        <DetailItem label="Date" value={appointment.date || '-'} />
        <DetailItem label="Time" value={appointment.time || '-'} />
        <DetailItem label="Kilos" value={`${appointment.kilos || 0} kg`} />
        <DetailItem label="Total" value={`₱${Number(appointment.totalPrice || 0).toFixed(2)}`} />
      </View>

      <View style={styles.paymentRow}>
        <Text style={styles.paymentLabel}>Payment: </Text>
        <Text style={[styles.paymentValue, appointment.paymentStatus === 'Paid' && styles.paymentPaid]}>
          {appointment.paymentStatus || 'Unpaid'}
        </Text>
      </View>

      {!!appointment.phone && <Text style={styles.noteText}>Phone: {appointment.phone}</Text>}
      {!!appointment.notes && <Text style={styles.noteText}>Note: {appointment.notes}</Text>}

      {footer && <View style={styles.cardFooter}>{footer}</View>}
    </View>
  );
}

function DetailItem({ label, value }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function StatusBadge({ status }) {
  const badgeStyle = [styles.statusBadge];
  if (status === 'Completed') badgeStyle.push(styles.statusCompleted);
  if (status === 'Ongoing') badgeStyle.push(styles.statusOngoing);
  if (status === 'Cancelled') badgeStyle.push(styles.statusCancelled);

  return (
    <View style={badgeStyle}>
      <Text style={styles.statusText}>{status || 'Pending'}</Text>
    </View>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🧺</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.mutedText}>{subtitle}</Text>
    </View>
  );
}

function Input({ label, multiline, ...props }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#94a3b8"
        style={[styles.input, multiline && styles.multilineInput]}
        multiline={multiline}
      />
    </View>
  );
}

function PrimaryButton({ title, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.primaryButton, disabled && styles.disabledButton]}>
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function OutlineButton({ title, onPress, danger }) {
  return (
    <Pressable onPress={onPress} style={[styles.outlineButton, danger && styles.dangerOutlineButton]}>
      <Text style={[styles.outlineButtonText, danger && styles.dangerOutlineText]}>{title}</Text>
    </Pressable>
  );
}

function ChoiceButton({ title, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.choiceButton, active && styles.choiceButtonActive]}>
      <Text style={[styles.choiceButtonText, active && styles.choiceButtonTextActive]}>{title}</Text>
    </Pressable>
  );
}

function TabButton({ title, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{title}</Text>
    </Pressable>
  );
}

function SmallChip({ title, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.smallChip, active && styles.smallChipActive]}>
      <Text style={[styles.smallChipText, active && styles.smallChipTextActive]}>{title}</Text>
    </Pressable>
  );
}

function sortAppointments(items) {
  return [...items].sort((a, b) => {
    const dateA = `${a.date || ''} ${a.time || ''}`;
    const dateB = `${b.date || ''} ${b.time || ''}`;
    return dateB.localeCompare(dateA);
  });
}

function cleanFirebaseError(message = '') {
  return message
    .replace('Firebase: ', '')
    .replace(/\(auth\/.+?\)\.?/g, '')
    .replace(/\(firestore\/.+?\)\.?/g, '')
    .trim();
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    padding: 24,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  logoText: {
    fontSize: 58,
  },
  splashTitle: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  splashSubtitle: {
    color: '#dbeafe',
    fontSize: 16,
    marginTop: 8,
  },
  centerContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
  },
  warningCard: {
    backgroundColor: '#ffffff',
    borderRadius: 26,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  warningIcon: {
    fontSize: 44,
    marginBottom: 10,
  },
  codeBox: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  codeText: {
    color: '#dbeafe',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
  },
  authContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 22,
  },
  smallLogoCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  smallLogoText: {
    fontSize: 36,
  },
  appName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
  },
  appTagline: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  title: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  mutedText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 21,
  },
  inputGroup: {
    marginTop: 14,
  },
  inputLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0f172a',
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  errorText: {
    marginTop: 12,
    color: '#dc2626',
    fontWeight: '700',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  choiceButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  choiceButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  choiceButtonText: {
    color: '#334155',
    fontWeight: '800',
  },
  choiceButtonTextActive: {
    color: '#ffffff',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  dangerOutlineButton: {
    borderColor: '#ef4444',
  },
  outlineButtonText: {
    color: '#2563eb',
    fontWeight: '900',
  },
  dangerOutlineText: {
    color: '#ef4444',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  linkText: {
    color: '#2563eb',
    fontWeight: '800',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#64748b',
    marginTop: 3,
  },
  headerBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontSize: 24,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#ffffff',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 12,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  content: {
    padding: 16,
    paddingBottom: 34,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  serviceGrid: {
    gap: 12,
    marginBottom: 16,
  },
  serviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  serviceCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  serviceIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  serviceName: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
  },
  serviceDescription: {
    color: '#64748b',
    marginTop: 3,
  },
  servicePrice: {
    color: '#2563eb',
    fontWeight: '900',
    marginTop: 8,
  },
  totalBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: '#1e3a8a',
    fontWeight: '800',
  },
  totalAmount: {
    color: '#1e3a8a',
    fontWeight: '900',
    fontSize: 22,
  },
  appointmentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  appointmentTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  appointmentTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
  },
  statusBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusCompleted: {
    backgroundColor: '#dcfce7',
  },
  statusOngoing: {
    backgroundColor: '#dbeafe',
  },
  statusCancelled: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '900',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  detailItem: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 12,
  },
  detailLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  detailValue: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  paymentRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  paymentLabel: {
    color: '#64748b',
    fontWeight: '700',
  },
  paymentValue: {
    color: '#dc2626',
    fontWeight: '900',
  },
  paymentPaid: {
    color: '#16a34a',
  },
  noteText: {
    color: '#475569',
    marginTop: 8,
    lineHeight: 20,
  },
  cardFooter: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  smallChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  smallChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  smallChipText: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 12,
  },
  smallChipTextActive: {
    color: '#ffffff',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: '47.8%',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
  },
  statIcon: {
    fontSize: 26,
  },
  statValue: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
  },
  statLabel: {
    color: '#64748b',
    fontWeight: '700',
    marginTop: 2,
  },
  featureText: {
    color: '#334155',
    marginBottom: 8,
    lineHeight: 20,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    alignItems: 'center',
    padding: 28,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  profileAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  profileAvatarText: {
    fontSize: 42,
  },
  profileInfoBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  profileInfoLabel: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 12,
  },
  profileInfoValue: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 16,
    marginTop: 3,
  },
});
