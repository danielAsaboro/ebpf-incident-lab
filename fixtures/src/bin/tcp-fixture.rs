use std::{
    env,
    io::{self, Read, Write},
    net::{TcpListener, TcpStream},
    thread,
    time::Duration,
};

fn main() -> io::Result<()> {
    match env::args().nth(1).as_deref() {
        Some("server") => server(),
        Some("client") => client(),
        _ => {
            eprintln!("usage: tcp-fixture <server|client>");
            std::process::exit(2);
        }
    }
}

fn server() -> io::Result<()> {
    let listener = TcpListener::bind(("0.0.0.0", 18080))?;
    println!("listening on 0.0.0.0:18080");
    for stream in listener.incoming().take(1) {
        let mut stream = stream?;
        let mut data = [0_u8; 4096];
        let _ = stream.read(&mut data)?;
        stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK")?;
    }
    Ok(())
}

fn client() -> io::Result<()> {
    for request in 1..=1 {
        let mut stream = TcpStream::connect(("127.0.0.1", 18080))?;
        stream.write_all(b"GET / HTTP/1.1\r\nHost: fixture\r\n\r\n")?;
        let mut response = [0_u8; 64];
        let _ = stream.read(&mut response)?;
        println!("request={request} ok");
        thread::sleep(Duration::from_millis(50));
    }
    Ok(())
}
