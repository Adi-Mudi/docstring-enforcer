/* Fixture sample for the C docstring checker. */

#include <stdio.h>

#define MAX_RETRIES 5

#define CLAMP(v, lo, hi) ((v) < (lo) ? (lo) : ((v) > (hi) ? (hi) : (v)))

struct buffer {
    char *data;
    long len;
};

typedef void (*visit_fn)(void *);

/**
 * Parse a config file into a config structure.
 * @param path Path to the file; must be readable.
 * @return 0 on success, -1 on failure.
 */
int parse_config(const char *path);

int g_mode;

static int hash_key(const char *s);

int add(int a, int b)
{
    return a + b;
}

/* Compute the difference of two numbers. */
int sub(int a, int b);

/// Multiply two values.
int mul(int a, int b);
