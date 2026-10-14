//! Sample Rust file for testing.

/// A documented function.
pub fn documented(x: u8) -> u8 {
    x
}

pub fn missingFn(x: u8) -> u8 {
    x
}

fn privateHelper() {}

/// A documented struct.
pub struct Config {
    /// A documented field.
    pub name: String,
    pub missingField: u8,
    secret: u8,
}

/// A documented enum.
pub enum Mode {
    /// A documented variant.
    V1,
    V2,
}

impl Config {
    /// A documented method.
    pub fn documented_method(&self) {}

    pub fn missingMethod(&self) {}
}

struct Private;
impl Private {
    pub fn on_private() {}
}
