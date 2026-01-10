# Tallo
Tallo is a self hosted image and media board.<br><br>
<img width="1454" height="800" alt="Captura de pantalla 2026-01-09 a la(s) 11 16 21 p m" src="https://github.com/user-attachments/assets/0959ffc7-7c32-456f-9bc1-c41c200bd4be" />

## Get Started
1. Create a folder `mkdir tallo21`
2. Go into folder `cd tallo21`
3. Create a compose file `nano compose.yaml`
4. Paste the following Docker Compose into the yaml file
5. Save your yaml file (ctrl + x, then click y to save, then hit enter)
6. Then run `docker compose up -d`
7. Profit
8. Oh this is Linux CLI instructions I probably should have said that first.
<br><br>
### Docker Compose
```
services:
  tallo:
    image: volumedata21/tallo21:latest
    container_name: tallo
    volumes:
      - ./data:/data
    ports:
      - 5521:3000
    restart: unless-stopped
```
