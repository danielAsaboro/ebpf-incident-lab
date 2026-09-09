use clap::Parser;
use incident_cli::CommonArgs;

fn main() -> anyhow::Result<()> {
    incident_runner::run(7, CommonArgs::parse())
}
