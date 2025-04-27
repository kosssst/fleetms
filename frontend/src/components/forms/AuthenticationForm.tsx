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
import {useForm} from '@mantine/form';
import {useToggle} from '@mantine/hooks';
import axios from 'axios';
import classes from './AuthenticationForm.module.scss';
import {API_BASE_URL, PROJECT_NAME} from '@/constants/appConfig';

export function AuthenticationForm(props: PaperProps) {
    const [type, toggle] = useToggle(['login', 'register']);
    const form = useForm({
        initialValues: {
            first_name: '',
            last_name: '',
            username: '',
            email: '',
            password: '',
            confirmPassword: '',
            terms: false,
        },

        validate: {
            first_name: (val) => (type === 'login' || /^\p{L}+$/u.test(val) ? null : 'Invalid first name'),
            last_name: (val) => (type === 'login' || /^\p{L}*$/u.test(val) ? null : 'Invalid last name'),
            username: (val) => (type === 'login' || /^[a-zA-Z0-9_]{3,}$/.test(val) ? null : 'Invalid username'),
            password: (val) => (val.length < 8 ? 'Password should include at least 8 characters' : null),
            confirmPassword: (val, values) => (type === 'login' || val === values.password ? null : 'Passwords do not match'),
            terms: (val) => (type === 'login' || val ? null : 'You should accept terms and conditions'),
            email: (val) => {
                if (type === 'login') {
                    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val) ||
                    /^[a-zA-Z0-9_]{3,}$/.test(val)
                        ? null
                        : 'Invalid email or username';
                } else {
                    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val)
                        ? null
                        : 'Invalid email';
                }
            },
        },
    });

    async function handleSubmit() {
        if (type === 'register') {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { confirmPassword, terms, ...values } = form.values;

            await axios.post(`${API_BASE_URL}/auth/signup`, values, {
                headers: {
                    'Content-Type': 'application/json',
                },
            }).then((response) => {
                if (response.status === 200 || response.status === 201) {
                    toggle();
                } else {
                    alert(response.data.error);
                }
            }).catch((error) => {
                console.error(error);
                alert('Something went wrong');
            });
        }

        if (type === 'login') {
            const { email, password } = form.values;
            const isEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);


            await axios.post(`${API_BASE_URL}/auth/login`, isEmail
                ? { email, password }
                : { username: email, password }, {
                headers: {
                    'Content-Type': 'application/json',
                },
                withCredentials: true,
            }).then((response) => {
                if (response.status === 200 || response.status === 201) {
                    localStorage.setItem('user_id', response.data.user_id);
                    localStorage.setItem('username', response.data.username);
                    localStorage.setItem('email', response.data.email);
                    localStorage.setItem('first_name', response.data.first_name);
                    localStorage.setItem('last_name', response.data.last_name);
                    localStorage.setItem('role', response.data.role);
                    if (response.data.company_id) {
                        localStorage.setItem('company_id', response.data.company_id);
                    }
                    window.location.href = new URLSearchParams(window.location.search).get('redirect') || '/';
                } else {
                    alert(response.data.error);
                }
            }).catch((error) => {
                console.error(error);
                alert('Something went wrong');
            });
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
                        <TextInput
                            required
                            label="First name"
                            placeholder="Your first name"
                            value={form.values.first_name}
                            onChange={(event) => form.setFieldValue('first_name', event.currentTarget.value)}
                            error={form.errors.firstName && 'Invalid first name'}
                            radius="md"
                        />
                    )}

                    {type === 'register' && (
                        <TextInput
                            label="Last name"
                            placeholder="Your last name"
                            value={form.values.last_name}
                            onChange={(event) => form.setFieldValue('last_name', event.currentTarget.value)}
                            error={form.errors.lastName && 'Invalid last name'}
                            radius="md"
                        />
                    )}

                    {type === 'register' && (
                        <TextInput
                            required
                            label="Username"
                            placeholder="Your username"
                            value={form.values.username}
                            onChange={(event) => form.setFieldValue('username', event.currentTarget.value)}
                            error={form.errors.username && 'Invalid username'}
                            radius="md"
                        />
                    )}

                    <TextInput
                        required
                        label={type === 'login' ? "Email or Username" : "Email"}
                        placeholder={type === 'login' ? "Your email or username" : "hello@mantine.dev"}
                        value={form.values.email}
                        onChange={(event) => form.setFieldValue('email', event.currentTarget.value)}
                        error={form.errors.email && (type === 'login' ? 'Invalid email or username' : 'Invalid email')}
                        radius="md"
                    />

                    <PasswordInput
                        required
                        label="Password"
                        placeholder="Your password"
                        value={form.values.password}
                        onChange={(event) => form.setFieldValue('password', event.currentTarget.value)}
                        error={form.errors.password && 'Password should include at least 6 characters'}
                        radius="md"
                    />

                    { type === 'register' && (
                        <PasswordInput
                            required
                            label="Confirm Password"
                            placeholder="Your password"
                            value={form.values.confirmPassword}
                            onChange={(event) => form.setFieldValue('confirmPassword', event.currentTarget.value)}
                            error={form.errors.confirmPassword && 'Passwords do not match'}
                            radius="md"
                        />
                    )}

                    {type === 'register' && (
                        <Checkbox
                            label="I accept terms and conditions"
                            checked={form.values.terms}
                            onChange={(event) => form.setFieldValue('terms', event.currentTarget.checked)}
                            error={form.errors.terms && 'You should accept terms and conditions'}
                        />
                    )}
                </Stack>

                <Group justify="space-between" mt="xl">
                    <Anchor component="button" type="button" c="dimmed" onClick={() => toggle()} size="xs">
                        {type === 'register'
                            ? 'Already have an account? Login'
                            : "Don't have an account? Register"}
                    </Anchor>
                    {type === 'register' && (
                        <Button type="submit" radius="xl" disabled={!form.isValid}>
                            Register
                        </Button>
                    )}
                    {type === 'login' && (
                        <Button type="submit" radius="xl">
                            Login
                        </Button>
                    )}
                </Group>
            </form>
        </Paper>
    );
}