/*
 *    Copyright (c) 2014-2017 Neil Ellis
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *          http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

package dollar.uri.socketio;

import com.corundumstudio.socketio.AckRequest;
import com.corundumstudio.socketio.SocketIOClient;
import com.corundumstudio.socketio.listener.ConnectListener;
import com.corundumstudio.socketio.listener.DataListener;
import com.corundumstudio.socketio.listener.DisconnectListener;
import dollar.api.Pipeable;
import dollar.api.Value;
import dollar.api.types.DollarFactory;
import dollar.api.uri.URI;
import org.jetbrains.annotations.NotNull;

class SocketIOSubscription implements DataListener<String>, ConnectListener, DisconnectListener {
    @NotNull
    private final Pipeable consumer;
    @NotNull
    private final String id;
    @NotNull
    private final URI uri;
    private boolean destroyed;

    public SocketIOSubscription(@NotNull Pipeable consumer, @NotNull String id, @NotNull URI uri) {

        this.consumer = consumer;
        this.id = id;
        this.uri = uri;
    }

    public void destroy() {
        destroyed = true;
    }

    @NotNull
    private String getPath() {return uri.path().substring(1);}

    @Override
    public void onConnect(@NotNull SocketIOClient client) {
        if (!destroyed) {
            client.joinRoom(getPath());
        }
    }

    @Override
    public void onData(@NotNull SocketIOClient client, @NotNull String data, @NotNull AckRequest ackSender) throws
            Exception {
        if (!destroyed) {
            final Value result = consumer.pipe(DollarFactory.fromStringValue(data));
            if (ackSender.isAckRequested()) {
                ackSender.sendAckData(result.toHumanString());
            }
        }

    }

    @Override
    public void onDisconnect(@NotNull SocketIOClient client) {
        client.leaveRoom(getPath());
    }

}
