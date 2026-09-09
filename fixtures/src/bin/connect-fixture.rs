use std::{
    io::{self, Read, Write},
    net::{TcpListener, TcpStream},
    thread,
};

fn main() -> io::Result<()> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    let address = listener.local_addr()?;
    let server = thread::spawn(move || -> io::Result<()> {
        let (mut stream, _) = listener.accept()?;
        let mut byte = [0_u8; 1];
        stream.read_exact(&mut byte)?;
        Ok(())
    });

    let mut stream = TcpStream::connect(address)?;
    stream.write_all(&[1])?;
    server.join().expect("fixture server panicked")?;
    println!("success destination={address}");

    match TcpStream::connect(address) {
        Ok(_) => println!("unexpected-success destination={address}"),
        Err(error) => println!("expected-failure destination={address} error={error}"),
    }
    Ok(())
}
