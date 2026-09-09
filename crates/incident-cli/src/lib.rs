use clap::Parser;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OutputFormat {
    Human,
    Json,
}

#[derive(Debug, Parser)]
#[command(author, version, about)]
pub struct CommonArgs {
    /// Stop tracing after this many seconds.
    #[arg(long, default_value_t = 30, value_parser = parse_duration)]
    pub duration: u64,

    /// Only show events for this host PID.
    #[arg(long)]
    pub pid: Option<u32>,

    /// Emit newline-delimited JSON instead of a human-readable table.
    #[arg(long)]
    pub json: bool,
}

impl CommonArgs {
    pub const fn output_format(&self) -> OutputFormat {
        if self.json {
            OutputFormat::Json
        } else {
            OutputFormat::Human
        }
    }
}

fn parse_duration(value: &str) -> Result<u64, String> {
    let duration = value
        .parse::<u64>()
        .map_err(|_| "duration must be an integer number of seconds".to_owned())?;
    if duration == 0 {
        return Err("duration must be at least 1 second".to_owned());
    }
    Ok(duration)
}
