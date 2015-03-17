import datetime
import json
import logging

from track.utils import DateTimeJSONEncoder


perflog = logging.getLogger("perflog")


def _get_request_header(request, header_name, default=''):
    """Helper method to get header values from a request's META dict, if present."""
    if request is not None and hasattr(request, 'META') and header_name in request.META:
        return request.META[header_name]
    else:
        return default


def _get_request_value(request, value_name, default=''):
    """Helper method to get header values from a request's REQUEST dict, if present."""
    if request is not None and hasattr(request, 'REQUEST') and value_name in request.REQUEST:
        return request.REQUEST[value_name]
    else:
        return default


def performance_log(request):
    """
    Log when POST call to "performance" URL is made by a user.
    Request should provide "event" and "page" arguments.
    """
    page = _get_request_value(request, 'page')

    event = {
        "ip": _get_request_header(request, 'REMOTE_ADDR'),
        "referer": _get_request_header(request, 'HTTP_REFERER'),
        "accept_language": _get_request_header(request, 'HTTP_ACCEPT_LANGUAGE'),
        "event_source": "browser",
        "event": _get_request_value(request, 'event'),
        "agent": _get_request_header(request, 'HTTP_USER_AGENT'),
        "page": page,
        "id": _get_request_value(request, 'id'),
        "expgroup": _get_request_value(request, 'expgroup'),
        "value": _get_request_value(request, 'value'),
        "time": datetime.datetime.utcnow(),
        "host": _get_request_header(request, 'SERVER_NAME'),
    }

    perflog.info(json.dumps(event, cls=DateTimeJSONEncoder))

    return HttpResponse(status=204)
