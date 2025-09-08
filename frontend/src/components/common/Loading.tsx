"use client";

import { Loader } from '@mantine/core';
import classes from '../../styles/Loading.module.scss';

export function Loading() {
  return (
    <div className={classes.spinnerContainer}>
      <Loader color="white" />
    </div>
  );
}
