admins = {}

modules_enabled = {
    "bosh";
    "websocket";
    "presence";
    "roster";
    "muc";
    "mam";
    "ping";
    "version";
}

allow_registration = true

c2s_require_encryption = false
s2s_require_encryption = false

VirtualHost "localhost"
    authentication = "anonymous"

Component "conference.localhost" "muc"
    name = "5x5 Rooms"