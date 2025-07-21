"use client";

import {
    Anchor,
    Button,
    Checkbox,
    Group,
    Paper,
    PaperProps,
    PasswordInput,
    Stack,
    Text,
    TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useToggle } from '@mantine/hooks';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { login, register } from '@/services/auth.service';
import { RegisterFormValues } from '@/types/auth.types';
import classes from './AuthenticationForm.module.scss';
import { PROJECT_NAME } from '@/constants/appConfig';

export function AuthenticationForm(props: PaperProps) {
    const [type, toggle] = useToggle(['login', 'register']);
    const router = useRouter();
    const form = useForm({
        initialValues: {
            firstName: '',
            lastName: '',
            email: '',
            password: '',
            confirmPassword: '',
            terms: false,
        },

        validate: {
            firstName: (val) => (type === 'login' || /^\p{L}+$/u.test(val) ? null : 'Invalid first name'),
            lastName: (val) => (type === 'login' || /^\p{L}*$/u.test(val) ? null : 'Invalid last name'),
            password: (val) => (val.length < 8 ? 'Password should include at least 8 characters' : null),
            confirmPassword: (val, values) => (type === 'login' || val === values.password ? null : 'Passwords do not match'),
            terms: (val) => (type === 'login' || val ? null : 'You should accept terms and conditions'),
            email: (val) => (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val) ? null : 'Invalid email'),
        },
    });

    async function handleSubmit() {
        if (type === 'register') {
            const { ...values } = form.values;
            try {
                await register(values as RegisterFormValues);
                toggle();
            } catch (error) {
                console.error(error);
                alert('Something went wrong');
            }
        }

        if (type === 'login') {
            const { email, password } = form.values;
            try {
                const data = await login({ email, password });
                Cookies.set('token', data.token);
                localStorage.setItem('user', JSON.stringify(data));
                if (data.companyId) {
                    localStorage.setItem('company_id', data.companyId);
                }
                router.push('/');
            } catch (error) {
                console.error(error);
                alert('Something went wrong');
            }
        }
    }

    return (
        <Paper radius="md" p="xl" withBorder {...props} className={classes.form}>
            <Text size="lg" fw={500}>
                Welcome to {PROJECT_NAME}, {type} with
            </Text>
            <div style={{ margin: '1em 0' }} />
            <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack>
                    {type === 'register' && (
                        <>
                            <TextInput
                                required
                                label="First name"
                                placeholder="Your first name"
                                value={form.values.firstName}
                                onChange={(event) => form.setFieldValue('firstName', event.currentTarget.value)}
                                error={form.errors.firstName && 'Invalid first name'}
                                radius="md"
                            />
                            <TextInput
                                label="Last name"
                                placeholder="Your last name"
                                value={form.values.lastName}
                                onChange={(event) => form.setFieldValue('lastName', event.currentTarget.value)}
                                error={form.errors.lastName && 'Invalid last name'}
                                radius="md"
                            />
                        </>
                    )}

                    <TextInput
                        required
                        label="Email"
                        placeholder="hello@mantine.dev"
                        value={form.values.email}
                        onChange={(event) => form.setFieldValue('email', event.currentTarget.value)}
                        error={form.errors.email}
                        radius="md"
                    />

                    <PasswordInput
                        required
                        label="Password"
                        placeholder="Your password"
                        value={form.values.password}
                        onChange={(event) => form.setFieldValue('password', event.currentTarget.value)}
                        error={form.errors.password && 'Password should include at least 8 characters'}
                        radius="md"
                    />

                    {type === 'register' && (
                        <>
                            <PasswordInput
                                required
                                label="Confirm Password"
                                placeholder="Your password"
                                value={form.values.confirmPassword}
                                onChange={(event) => form.setFieldValue('confirmPassword', event.currentTarget.value)}
                                error={form.errors.confirmPassword && 'Passwords do not match'}
                                radius="md"
                            />
                            <Checkbox
                                label="I accept terms and conditions"
                                checked={form.values.terms}
                                onChange={(event) => form.setFieldValue('terms', event.currentTarget.checked)}
                                error={form.errors.terms && 'You should accept terms and conditions'}
                            />
                        </>
                    )}
                </Stack>

                <Group justify="space-between" mt="xl">
                    <Anchor component="button" type="button" c="dimmed" onClick={() => toggle()} size="xs">
                        {type === 'register'
                            ? 'Already have an account? Login'
                            : "Don't have an account? Register"}
                    </Anchor>
                    <Button type="submit" radius="xl">
                        {type === 'register' ? 'Register' : 'Login'}
                    </Button>
                </Group>
            </form>
        </Paper>
    );
}
