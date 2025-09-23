# Data Transfer Protocol

## Overview:

This is a binary protocol designed for efficient transmission of vehicle telemetry data.

This protocol uses Websocket as the transport layer. Each message consists of a fixed-size binary frame.

## Frame Structure:

### Header:

Header is 1 byte long and goes at start of each frame.

| Bit Position | Description                                                                                                                 |
|--------------|-----------------------------------------------------------------------------------------------------------------------------|
| 0            | Frame Type (0 = CONTROL, 1 = DATA)                                                                                          |
| 1            | Reserved                                                                                                                    |
| 2-7          | If CONTROL frame - command type (See below).<br>If DATA frame - unsigned 6-bit integer - number of dataframes after header. |

#### Control frame

`2-7` bits in control frame specify command type:

| Bits            | Command         | Description                    |
|-----------------|-----------------|--------------------------------|
| 000000          | AUTH_REQ        | Authentication request         |
| 000001          | AUTH_OK         | Authentication successful      |
| 000010          | START_TRIP_REQ  | Request to start trip logging  |
| 000011          | START_TRIP_OK   | Trip logging started           |
| 000100          | RESUME_TRIP_REQ | Request to resume trip logging |
| 000101          | RESUME_TRIP_OK  | Trip logging resumed           |
| 000110          | END_TRIP_REQ    | Request to end trip logging    |
| 000111          | END_TRIP_OK     | Trip logging ended             |
| 001000          | ACK             | Acknowledgment                 |
| 001001          | ERROR           | Error notification             |
| 001010          | PING            | Ping request                   |
| 001011          | PONG            | Pong response                  |
| 001100          | PAUSE_TRIP_REQ  | Request to pause trip logging  |
| 001101          | PAUSE_TRIP_OK   | Trip logging paused            |
| 001110          | CONFIG_REQ      | Configuration request          |
| 001111          | CONFIG_ACK      | Configuration successful       |
| 010000 - 111111 | RESERVED        | Reserved                       |

COMMAND frame structure:

- AUTH_REQ:
```text
header: 0x00
token_length: uint16 (number of bytes in token)
token: byte[token_length] (authentication token) - max 256 bytes
```

- AUTH_OK:
```text
header: 0x01
session_id_length: uint16 (number of bytes in session_id) - 
session_id: byte[session_id_length] (unique session identifier) - max 256 bytes
```

- START_TRIP_REQ:
```text
header: 0x02
```
- START_TRIP_OK:
```text
header: 0x03
trip_id_length: uint16 (number of bytes in trip_id)
trip_id: byte[trip_id_length] (unique trip identifier) - max 256 bytes
```

- RESUME_TRIP_REQ:
```text
header: 0x04
trip_id_length: uint16 (number of bytes in trip_id)
trip_id: byte[trip_id_length] (unique trip identifier) - max 256 bytes
```

- RESUME_TRIP_OK:
```text
header: 0x05
```

- END_TRIP_REQ:
```text
header: 0x06
```

- END_TRIP_OK:
```text
header: 0x07
```

- ACK:
```text
header: 0x08
```

- ERROR:
```text
header: 0x09
error_code: uint64 (error code)
```

- PING:
```text
header: 0x0A
```

- PONG:
```text
header: 0x0B
```

- PAUSE_TRIP_REQ:
```text
header: 0x0C
```

- PAUSE_TRIP_OK:
```text
header: 0x0D
```

- CONFIG_REQ:
```text
header: 0x0E
```

- CONFIG_ACK:
```text
header: 0x0F
n1: uint16 (number of DATA frames after which ACK should be sent by server)
t1: uint16 (ping interval in seconds when trip is paused)
t2: uint16 (ping timeout in seconds when trip is paused)
```

DATA frame structure:

DATA frames contain telemetry data. Each DATA frame should contain at least one telemetry data record. Number of records is specified in the 2-7 bits of header (0-63).

Each telemetry data record is 32 bytes long and contains the following fields in following order:

| metric                | encoding | decoding method                                 |
|-----------------------|----------|-------------------------------------------------|
| timestamp             | `uint64` | UNIX ms since epoch                             |
| gps_longitude         | `int32`  | `int32`                                         |
| gps_latitude          | `int32`  | `int32`                                         |
| gps_altitude          | `int32`  | `int32`                                         |
| vehicle_speed         | `uint16` | `uint16 / 100.0`                                |
| engine_speed          | `uint16` | `uint16`                                        |
| accelerator_position  | `uint16` | `(uint16 - 0x0097) * (100 / (0x0339 - 0x0097))` |
| engine_coolant_temp   | `uint16` | `(uint16 / 10.0) - 273.15`                      |
| intake_air_temp       | `uint16` | `(uint16 / 10.0) - 273.15`                      |
| fuel_consumption_rate | `uint16` | `uint16`                                        |


## Flow:

Normal flow:
1. Client connects to server via Websocket.
2. Client sends AUTH_REQ with authentication token.
3. Server responds with AUTH_OK and session_id if authentication is successful.
4. Client sends CONFIG_REQ to get configuration parameters.
5. Server responds with CONFIG_ACK with parameters `n1`, `t1`, `t2`.
6. Client sends START_TRIP_REQ to begin trip logging.
7. Server responds with START_TRIP_OK and trip_id.
8. Client sends DATA frames with telemetry data.
9. Server acknowledges each `n1` DATA frames with ACK control frame. if not - reconnect it triggered.
10. Client sends END_TRIP_REQ to end trip logging.

In case when trip is paused, client sends PING frame every `t1` seconds. If server does not respond with PING in `t2` seconds, client should attempt to reconnect.

Client can pause trip by sending PAUSE_TRIP_REQ. Server responds with PAUSE_TRIP_OK. To resume, client sends RESUME_TRIP_REQ and server responds with RESUME_TRIP_OK.

On disconnection, client should attempt to reconnect to server.

On reconnection, should be followed next steps:
1. Client sends AUTH_REQ with authentication token.
2. Server responds with AUTH_OK and session_id if authentication is successful.
3. Client sends CONFIG_REQ to get configuration parameters.
4. Server responds with CONFIG_ACK with parameters `n1`, `t1`, `t2`.
5. Client sends RESUME_TRIP_REQ with previous trip_id.
6. Server responds with RESUME_TRIP_OK.
7. Client resumes sending DATA frames. Additionally, client sends DATA frames with telemetry frames which were collected when client was not connected to server.

