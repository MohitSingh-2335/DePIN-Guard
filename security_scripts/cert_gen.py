from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
import datetime, os
import sys

# Safety check — don't overwrite existing keys
if os.path.exists("docker/certs/ca.key"):
    print("Notice: Keys already exist! Use --force to regenerate.")
    print("    python cert_gen.py --force")
    if "--force" not in sys.argv:
        sys.exit(0)

# ─── Generate CA private key ───
ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

# ─── Generate CA certificate ───
ca_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "DePIN-Guard-CA")])
ca_cert = (
    x509.CertificateBuilder()
    .subject_name(ca_name)
    .issuer_name(ca_name)
    .public_key(ca_key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(datetime.datetime.utcnow())
    .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=365))
    .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
    .sign(ca_key, hashes.SHA256())
)

# ─── Generate SERVER private key & certificate ───
server_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
server_cert = (
    x509.CertificateBuilder()
    .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")]))
    .issuer_name(ca_name)
    .public_key(server_key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(datetime.datetime.utcnow())
    .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=365))
    .sign(ca_key, hashes.SHA256())
)

# ─── Generate CLIENT private key & certificate ───
client_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
client_cert = (
    x509.CertificateBuilder()
    .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "depin-client")]))
    .issuer_name(ca_name)
    .public_key(client_key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(datetime.datetime.utcnow())
    .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=365))
    .sign(ca_key, hashes.SHA256())
)

# ─── Save to docker/certs/ ───
os.makedirs("docker/certs", exist_ok=True)

with open("docker/certs/ca.crt", "wb") as f:
    f.write(ca_cert.public_bytes(serialization.Encoding.PEM))

with open("docker/certs/ca.key", "wb") as f:
    f.write(ca_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption()
    ))

with open("docker/certs/server.crt", "wb") as f:
    f.write(server_cert.public_bytes(serialization.Encoding.PEM))

with open("docker/certs/server.key", "wb") as f:
    f.write(server_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption()
    ))

# ─── Save client certs to security_scripts/ ───
with open("security_scripts/client.crt", "wb") as f:
    f.write(client_cert.public_bytes(serialization.Encoding.PEM))

with open("security_scripts/client.key", "wb") as f:
    f.write(client_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption()
    ))

print("CA generated: docker/certs/ca.crt, docker/certs/ca.key")
print("Server certs: docker/certs/server.crt, docker/certs/server.key")
print("Client certs: security_scripts/client.crt, security_scripts/client.key")
print("Keep client certificates secure - do not commit private keys to GitHub.")