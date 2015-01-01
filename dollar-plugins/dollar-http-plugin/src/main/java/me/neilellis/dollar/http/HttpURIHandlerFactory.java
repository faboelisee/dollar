/*
 * Copyright (c) 2014-2015 Neil Ellis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package me.neilellis.dollar.http;

import me.neilellis.dollar.api.uri.URI;
import me.neilellis.dollar.api.uri.URIHandler;
import me.neilellis.dollar.api.uri.URIHandlerFactory;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.io.IOException;


public class HttpURIHandlerFactory implements URIHandlerFactory {


    @NotNull @Override
    public URIHandlerFactory copy() {
        return this;
    }

    @Nullable @Override
    public URIHandler forURI(String scheme, @NotNull URI uri) throws IOException {
        return new HttpURIHandler(scheme, uri);
    }

    @Override
    public boolean handlesScheme(@NotNull String scheme) {
        return scheme.equals("http") || scheme.equals("https");
    }
}

