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
9. Project runs best when paired with SSL (having a secure domain name via a reverse proxy like Nginx Proxy Manager).
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
## About Tallo
Tallo is Spanish for stem. Think of this as an app for growing your ideas. The idea is to be able to visually organize your thoughts and even map them out. It is completely self hosted and open source. This project is inspired by another open source project known as Pinry.

### Features
- Organize images and videos into boards.
- Organize boards into collections.
- Tag images with keywords
- Tag images with source URLs
- Tag images with geolocation
- See a map of your boards based on image geolocations
- Share boards
- Make your instance public or private
- Make boards public or private
- Add users to your instance
- Web Extension / Add-on

### Web Extensions
Tallo does have a web extension. It is currently available for [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tallo-saver/) and Chrome. For Chrome you'll have to download the files in the 'Tallo-extensions' folder and install manually. When adding your server you can get your API key in your profile settings/security tab. The Tallo web extension/add-on allows for greater flexibility in adding images. Sites that aren't available through the normal URL uploader will typically work with the web extension. 

### AI Coding
Tallo is mostly done in AI with my very basic knowledge of Docker, HTML, CSS, and Javascript/Typescript. I can typically make smaller updates but the project does rely on AI for most bigger updates. The entire project is open source and I'm hopeful actual developers will review this project. This is very much a learning project for me to be able to code my own apps.
